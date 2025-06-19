#!/usr/bin/env python3

import logging
import argparse
import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import json
from mcp import types
from mcp.server.fastmcp import FastMCP
import websockets


# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Global counter for Chrome DevTools Protocol message IDs
_cdp_message_id = 0
_cdp_responses = {}
_cdp_events = {}  # Store for CDP events like console logs and network requests


async def send_cdp_command(ws, method: str, params: dict = {}) -> dict:
    """Helper function to send a command over CDP and wait for the response."""
    global _cdp_message_id
    _cdp_message_id += 1
    message_id = _cdp_message_id
    command = {"id": message_id, "method": method, "params": params}
    logging.debug(f"Sending CDP command: {json.dumps(command)}")
    await ws.send(json.dumps(command))

    # Wait for the response with the matching ID
    while message_id not in _cdp_responses:
        await asyncio.sleep(0.01)  # Small sleep to prevent busy-waiting

    response = _cdp_responses.pop(message_id)
    logging.debug(f"Received CDP response: {json.dumps(response)}")
    if "error" in response:
        raise RuntimeError(f"CDP Error: {response['error']['message']}")
    return response.get("result", {})


async def cdp_listener(ws):
    """Listen for messages from CDP and store responses and events."""
    async for message in ws:
        try:
            data = json.loads(message)
            if "id" in data:
                _cdp_responses[data["id"]] = data
            elif "method" in data:
                # Handle events (console logs, network, etc.)
                event_type = data["method"].split(".")[0]  # e.g., Console, Network
                if event_type not in _cdp_events:
                    _cdp_events[event_type] = []
                _cdp_events[event_type].append(data)
                # Cap the number of stored events to prevent memory issues
                if len(_cdp_events[event_type]) > 1000:
                    _cdp_events[event_type] = _cdp_events[event_type][-1000:]
                logging.debug(f"Received CDP Event: {data['method']}")
        except json.JSONDecodeError:
            logging.error(f"Failed to decode CDP message: {message}")
        except Exception as e:
            logging.error(f"Error processing CDP message: {e}")


@asynccontextmanager
async def app_lifespan(app: FastMCP) -> AsyncIterator[dict]:
    """Manage connection to Chrome DevTools Protocol during server lifespan."""
    logging.info("MCP Lifespan: Startup initiated.")
    state = {"cdp_ws": None, "cdp_listener_task": None}
    # --- Restore WebSocket Logic ---
    config = getattr(app, "state", {}).get("config", {})
    chrome_host = config.get("chrome_host", "127.0.0.1")
    chrome_port = config.get("chrome_port", 9222)
    cdp_uri = f"ws://{chrome_host}:{chrome_port}/devtools/browser"
    logging.info(f"Attempting to connect to Chrome DevTools Protocol at {cdp_uri}")
    try:
        state["cdp_ws"] = await websockets.connect(cdp_uri, max_size=None)
        state["cdp_listener_task"] = asyncio.create_task(cdp_listener(state["cdp_ws"]))
        logging.info("Successfully connected to Chrome DevTools Protocol.")
        yield state  # Pass connection state
    except (
        websockets.exceptions.ConnectionClosedError,
        OSError,
        websockets.exceptions.InvalidURI,
    ) as e:
        logging.error(f"Failed to connect to Chrome DevTools Protocol: {e}")
        yield state  # Yield empty state on connection failure
    finally:
        # --- Ensure cleanup runs ---
        logging.info("MCP Lifespan: Shutdown initiated.")
        if state["cdp_listener_task"]:
            logging.info("Cancelling CDP listener task.")
            state["cdp_listener_task"].cancel()
            try:
                await state["cdp_listener_task"]
            except asyncio.CancelledError:
                logging.info("CDP listener task cancelled successfully.")
                pass
            except Exception as e:
                logging.error(f"Error during CDP listener task cancellation: {e}")
        if state["cdp_ws"]:
            logging.info("Closing CDP websocket connection.")
            await state["cdp_ws"].close()
        logging.info("MCP Lifespan: Shutdown complete.")
    # --- End of Restored Logic ---


# Initialize FastMCP with the lifespan manager
mcp_app = FastMCP(
    "WebDebug", description="MCP Server for Chrome Debugging", lifespan=app_lifespan
)


# --- MCP Resource Example (Updated) ---
@mcp_app.resource("browser://tabs", description="List open browser tabs")
async def list_tabs() -> str:
    """
    Retrieves a list of open tabs from the connected Chrome instance as JSON.
    """
    ws = mcp_app.request_context.lifespan_context.get("cdp_ws")
    if not ws:
        return json.dumps({"error": "Not connected to Chrome."})

    logging.info("Received request to list tabs.")
    try:
        targets_result = await send_cdp_command(ws, "Target.getTargets")
        tabs = [
            {
                "id": t["targetId"],
                "title": t["title"],
                "url": t["url"],
                "type": t["type"],
            }
            for t in targets_result.get("targetInfos", [])
            if t["type"] == "page"
        ]
        return json.dumps({"tabs": tabs})
    except (RuntimeError, websockets.exceptions.ConnectionClosed) as e:
        logging.error(f"Error listing tabs: {e}")
        return json.dumps({"error": f"Error communicating with Chrome: {e}"})
    except Exception as e:
        logging.error(f"Unexpected error listing tabs: {e}")
        return json.dumps({"error": "An unexpected error occurred."})  # Generic error


# --- Helper function for tab interactions ---
async def create_tab_session(ws, target_id):
    """Helper function to create a session for a specific tab."""
    session_info = await send_cdp_command(
        ws, "Target.attachToTarget", {"targetId": target_id, "flatten": True}
    )
    session_id = session_info["sessionId"]

    async def send_page_command(method: str, params: dict = {}) -> dict:
        global _cdp_message_id
        _cdp_message_id += 1
        message_id = _cdp_message_id
        command = {
            "sessionId": session_id,
            "id": message_id,
            "method": method,
            "params": params,
        }
        logging.debug(f"Sending Page CDP command: {json.dumps(command)}")
        await ws.send(json.dumps(command))
        while message_id not in _cdp_responses:
            await asyncio.sleep(0.01)
        response = _cdp_responses.pop(message_id)
        logging.debug(f"Received Page CDP response: {json.dumps(response)}")
        if "error" in response:
            raise RuntimeError(f"CDP Error: {response['error']['message']}")
        return response.get("result", {})

    return session_id, send_page_command


# --- MCP Tool Example (Updated) ---
@mcp_app.tool(description="Get the HTML content of a specific tab")
async def get_tab_content(context, targetId: str) -> str:
    """
    Retrieves the outer HTML of the document for the specified tab (targetId).
    """
    ws = context.lifespan_context.get("cdp_ws")
    if not ws:
        return json.dumps({"error": "Not connected to Chrome."})

    logging.info(f"Received request to get content for tab: {targetId}")
    try:
        # We need to attach to the specific page target to interact with its DOM
        session_id, send_page_command = await create_tab_session(ws, targetId)

        # Get the document root
        doc = await send_page_command("DOM.getDocument", {"depth": 1})
        root_node_id = doc["root"]["nodeId"]

        # Get the outer HTML
        html_result = await send_page_command(
            "DOM.getOuterHTML", {"nodeId": root_node_id}
        )

        # Detach from the target
        await send_cdp_command(ws, "Target.detachFromTarget", {"sessionId": session_id})

        return json.dumps(
            {"targetId": targetId, "outerHTML": html_result.get("outerHTML", "")}
        )

    except (RuntimeError, websockets.exceptions.ConnectionClosed) as e:
        logging.error(f"Error getting tab content: {e}")
        return json.dumps(
            {"error": f"Error communicating with Chrome for tab {targetId}: {e}"}
        )
    except Exception as e:
        logging.error(f"Unexpected error getting tab content: {e}")
        return json.dumps(
            {"error": f"An unexpected error occurred processing tab {targetId}."}
        )


# --- New MCP Tool: Inspect Element ---
@mcp_app.tool(description="Inspect a specific element using CSS selector")
async def inspect_element(context, targetId: str, selector: str) -> str:
    """
    Inspects a specific element in the page using a CSS selector.
    Returns detailed information about the element.
    """
    ws = context.lifespan_context.get("cdp_ws")
    if not ws:
        return json.dumps({"error": "Not connected to Chrome."})

    logging.info(
        f"Received request to inspect element with selector '{selector}' in tab: {targetId}"
    )
    try:
        session_id, send_page_command = await create_tab_session(ws, targetId)

        # Get the document root
        doc = await send_page_command("DOM.getDocument", {"depth": 1})
        root_node_id = doc["root"]["nodeId"]

        # Find the element using querySelector
        query_result = await send_page_command(
            "DOM.querySelector", {"nodeId": root_node_id, "selector": selector}
        )

        if not query_result.get("nodeId"):
            await send_cdp_command(
                ws, "Target.detachFromTarget", {"sessionId": session_id}
            )
            return json.dumps({"error": f"Element not found with selector: {selector}"})

        # Get details about the element
        node_details = await send_page_command(
            "DOM.describeNode",
            {"nodeId": query_result["nodeId"], "depth": 1, "pierce": True},
        )

        # Get computed styles
        styles = await send_page_command(
            "CSS.getComputedStyleForNode", {"nodeId": query_result["nodeId"]}
        )

        # Get the HTML of the element
        html_result = await send_page_command(
            "DOM.getOuterHTML", {"nodeId": query_result["nodeId"]}
        )

        # Detach from the target
        await send_cdp_command(ws, "Target.detachFromTarget", {"sessionId": session_id})

        # Combine all information
        element_info = {
            "targetId": targetId,
            "selector": selector,
            "nodeDetails": node_details.get("node", {}),
            "computedStyles": styles.get("computedStyle", []),
            "outerHTML": html_result.get("outerHTML", ""),
        }

        return json.dumps(element_info)

    except (RuntimeError, websockets.exceptions.ConnectionClosed) as e:
        logging.error(f"Error inspecting element: {e}")
        return json.dumps({"error": f"Error communicating with Chrome: {e}"})
    except Exception as e:
        logging.error(f"Unexpected error inspecting element: {e}")
        return json.dumps({"error": f"An unexpected error occurred: {e!s}"})


# --- New MCP Resource: Console Logs ---
@mcp_app.resource(
    "browser://console/enable", description="Enable console message capturing"
)
async def enable_console_logs() -> str:
    """
    Enables console message capturing for all tabs.
    """
    ws = mcp_app.request_context.lifespan_context.get("cdp_ws")
    if not ws:
        return json.dumps({"error": "Not connected to Chrome."})

    logging.info("Enabling console message capturing")
    try:
        # First, get all page targets
        targets_result = await send_cdp_command(ws, "Target.getTargets")
        page_targets = [
            t["targetId"]
            for t in targets_result.get("targetInfos", [])
            if t["type"] == "page"
        ]

        results = []
        for target_id in page_targets:
            try:
                session_id, send_page_command = await create_tab_session(ws, target_id)

                # Enable console events for this tab
                await send_page_command("Console.enable")

                # Get the tab info for reference
                target_info = next(
                    (
                        t
                        for t in targets_result.get("targetInfos", [])
                        if t["targetId"] == target_id
                    ),
                    {},
                )

                results.append(
                    {
                        "targetId": target_id,
                        "title": target_info.get("title", ""),
                        "url": target_info.get("url", ""),
                        "status": "console_enabled",
                    }
                )

                # Keep the session open to receive events
                # (In a production app, you might want to track these sessions and clean them up)
            except Exception as e:
                results.append({"targetId": target_id, "error": str(e)})

        return json.dumps({"status": "success", "tabs": results})

    except (RuntimeError, websockets.exceptions.ConnectionClosed) as e:
        logging.error(f"Error enabling console logs: {e}")
        return json.dumps({"error": f"Error communicating with Chrome: {e}"})
    except Exception as e:
        logging.error(f"Unexpected error enabling console logs: {e}")
        return json.dumps({"error": f"An unexpected error occurred: {e!s}"})


@mcp_app.resource("browser://console/logs", description="Get captured console logs")
async def get_console_logs() -> str:
    """
    Returns all captured console logs.
    """
    if "Console" not in _cdp_events:
        return json.dumps({"logs": []})

    # Filter for console message events
    console_logs = [
        {
            "timestamp": event.get("params", {}).get("timestamp", 0),
            "level": event.get("params", {}).get("message", {}).get("level", "info"),
            "text": event.get("params", {}).get("message", {}).get("text", ""),
            "url": event.get("params", {}).get("message", {}).get("url", ""),
            "line": event.get("params", {}).get("message", {}).get("line", 0),
            "source": event.get("params", {}).get("message", {}).get("source", ""),
        }
        for event in _cdp_events.get("Console", [])
        if event.get("method") == "Console.messageAdded"
    ]

    return json.dumps({"logs": console_logs})


# --- New MCP Resource: Network Monitoring ---
@mcp_app.resource(
    "browser://network/enable", description="Enable network request monitoring"
)
async def enable_network_monitoring() -> str:
    """
    Enables network request monitoring for all tabs.
    """
    ws = mcp_app.request_context.lifespan_context.get("cdp_ws")
    if not ws:
        return json.dumps({"error": "Not connected to Chrome."})

    logging.info("Enabling network request monitoring")
    try:
        # First, get all page targets
        targets_result = await send_cdp_command(ws, "Target.getTargets")
        page_targets = [
            t["targetId"]
            for t in targets_result.get("targetInfos", [])
            if t["type"] == "page"
        ]

        results = []
        for target_id in page_targets:
            try:
                session_id, send_page_command = await create_tab_session(ws, target_id)

                # Enable network events for this tab
                await send_page_command("Network.enable")

                # Get the tab info for reference
                target_info = next(
                    (
                        t
                        for t in targets_result.get("targetInfos", [])
                        if t["targetId"] == target_id
                    ),
                    {},
                )

                results.append(
                    {
                        "targetId": target_id,
                        "title": target_info.get("title", ""),
                        "url": target_info.get("url", ""),
                        "status": "network_monitoring_enabled",
                    }
                )

                # Keep the session open to receive events
            except Exception as e:
                results.append({"targetId": target_id, "error": str(e)})

        return json.dumps({"status": "success", "tabs": results})

    except (RuntimeError, websockets.exceptions.ConnectionClosed) as e:
        logging.error(f"Error enabling network monitoring: {e}")
        return json.dumps({"error": f"Error communicating with Chrome: {e}"})
    except Exception as e:
        logging.error(f"Unexpected error enabling network monitoring: {e}")
        return json.dumps({"error": f"An unexpected error occurred: {e!s}"})


@mcp_app.resource(
    "browser://network/requests", description="Get captured network requests"
)
async def get_network_requests() -> str:
    """
    Returns all captured network requests.
    """
    if "Network" not in _cdp_events:
        return json.dumps({"requests": []})

    # Filter for network request events
    network_requests = []
    request_map = {}

    for event in _cdp_events.get("Network", []):
        if event.get("method") == "Network.requestWillBeSent":
            params = event.get("params", {})
            request_id = params.get("requestId")
            if request_id:
                request_map[request_id] = {
                    "requestId": request_id,
                    "url": params.get("request", {}).get("url", ""),
                    "method": params.get("request", {}).get("method", ""),
                    "headers": params.get("request", {}).get("headers", {}),
                    "timestamp": params.get("timestamp", 0),
                    "status": "pending",
                    "type": params.get("type", ""),
                }

        elif event.get("method") == "Network.responseReceived":
            params = event.get("params", {})
            request_id = params.get("requestId")
            if request_id and request_id in request_map:
                request_map[request_id].update(
                    {
                        "status": "received",
                        "statusCode": params.get("response", {}).get("status", 0),
                        "statusText": params.get("response", {}).get("statusText", ""),
                        "mimeType": params.get("response", {}).get("mimeType", ""),
                        "responseHeaders": params.get("response", {}).get(
                            "headers", {}
                        ),
                    }
                )

    # Convert request_map to list
    network_requests = list(request_map.values())

    return json.dumps({"requests": network_requests})


# --- Expose the actual ASGI app from FastMCP ---
app = mcp_app.sse_app()


def main():
    parser = argparse.ArgumentParser(description="WebDebug MCP Server")
    parser.add_argument(
        "--mcp-port",
        type=int,
        default=8080,
        help="Port for the MCP server to listen on",
    )
    parser.add_argument(
        "--mcp-host",
        type=str,
        default="127.0.0.1",
        help="Host interface for the MCP server (use 127.0.0.1 for local only)",
    )
    parser.add_argument(
        "--chrome-port",
        type=int,
        default=9222,
        help="Port Chrome Debugging Protocol is listening on",
    )
    parser.add_argument(
        "--chrome-host",
        type=str,
        default="127.0.0.1",
        help="Host Chrome Debugging Protocol is listening on",
    )
    args = parser.parse_args()

    # Pass Chrome config to the lifespan context via app state
    # Note: The lifespan is associated with mcp_app, not the derived 'app'
    mcp_app.state.config = {
        "chrome_host": args.chrome_host,
        "chrome_port": args.chrome_port,
    }

    # The script now only defines the app. Run it externally.
    print("MCP application object 'app' (derived from mcp_app.sse_app()) is defined.")
    print("To run the server, use one of the following commands in your terminal:")
    print("\nOption 1: Using Hypercorn (Recommended)")
    print(
        f"  hypercorn {__file__.split('/')[-1].replace('.py','')}:app --bind {args.mcp_host}:{args.mcp_port}"
    )
    print("\nOption 2: Using Uvicorn")
    print(
        f"  uvicorn {__file__.split('/')[-1].replace('.py','')}:app --host {args.mcp_host} --port {args.mcp_port}"
    )
    print(
        f"\nEnsure Chrome is running with remote debugging enabled on port {args.chrome_port}."
    )


if __name__ == "__main__":
    main()
