#!/usr/bin/env python3

import logging
import asyncio
import json
from mcp.server.fastmcp import FastMCP
import websockets


# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Global variables
_cdp_message_id = 0
_cdp_responses = {}

# FastMCP app
mcp_app = FastMCP(
    "SimpleWebDebug", description="Simple MCP Server for Chrome Debugging"
)


async def send_cdp_command(ws, method, params=None):
    """Send a command to Chrome DevTools Protocol and await response"""
    global _cdp_message_id
    if params is None:
        params = {}

    _cdp_message_id += 1
    message_id = _cdp_message_id

    command = {"id": message_id, "method": method, "params": params}

    logging.info(f"Sending CDP command: {method}")
    await ws.send(json.dumps(command))

    # Simple synchronous wait for response
    for _ in range(100):  # Wait up to ~1 second
        if message_id in _cdp_responses:
            response = _cdp_responses.pop(message_id)
            return response.get("result", {})
        await asyncio.sleep(0.01)

    raise TimeoutError(f"No response for command {method}")


async def connect_to_chrome(host="127.0.0.1", port=9222):
    """Connect to Chrome browser via CDP"""
    uri = f"ws://{host}:{port}/devtools/browser"
    try:
        ws = await websockets.connect(uri, max_size=None)
        return ws
    except Exception as e:
        logging.error(f"Failed to connect to Chrome at {uri}: {e}")
        return None


async def listen_for_messages(ws):
    """Listen for CDP messages"""
    async for message in ws:
        try:
            data = json.loads(message)
            if "id" in data:
                _cdp_responses[data["id"]] = data
        except Exception as e:
            logging.error(f"Error processing message: {e}")


@mcp_app.resource("browser://tabs", description="List open browser tabs")
async def list_tabs() -> str:
    """List all open tabs in Chrome"""
    try:
        # Connect to Chrome
        ws = await connect_to_chrome()
        if not ws:
            return json.dumps({"error": "Could not connect to Chrome"})

        # Start listener
        asyncio.create_task(listen_for_messages(ws))

        # Get targets
        targets = await send_cdp_command(ws, "Target.getTargets")

        # Filter for page targets (tabs)
        tabs = [
            {"id": t["targetId"], "title": t["title"], "url": t["url"]}
            for t in targets.get("targetInfos", [])
            if t["type"] == "page"
        ]

        await ws.close()
        return json.dumps({"tabs": tabs})
    except Exception as e:
        logging.error(f"Error listing tabs: {e}")
        return json.dumps({"error": str(e)})


@mcp_app.tool(description="Get HTML content of a tab")
async def get_tab_content(context, targetId: str) -> str:
    """Get HTML content of a specific tab"""
    try:
        # Connect to Chrome
        ws = await connect_to_chrome()
        if not ws:
            return json.dumps({"error": "Could not connect to Chrome"})

        # Start listener
        asyncio.create_task(listen_for_messages(ws))

        # Attach to target
        session = await send_cdp_command(
            ws, "Target.attachToTarget", {"targetId": targetId, "flatten": True}
        )

        session_id = session.get("sessionId")

        # Get document
        doc = await send_cdp_command(
            ws, "DOM.getDocument", {"sessionId": session_id, "depth": 1}
        )

        # Get outer HTML
        html = await send_cdp_command(
            ws,
            "DOM.getOuterHTML",
            {"sessionId": session_id, "nodeId": doc.get("root", {}).get("nodeId")},
        )

        # Detach from target
        await send_cdp_command(ws, "Target.detachFromTarget", {"sessionId": session_id})

        await ws.close()
        return json.dumps({"targetId": targetId, "html": html.get("outerHTML", "")})
    except Exception as e:
        logging.error(f"Error getting tab content: {e}")
        return json.dumps({"error": str(e)})


# Expose ASGI app
app = mcp_app.sse_app()

if __name__ == "__main__":
    print("Simple WebDebug MCP Server")
    print("Run with: hypercorn simple_debug:app --bind 127.0.0.1:8080")
    print("Ensure Chrome is running with --remote-debugging-port=9222")
