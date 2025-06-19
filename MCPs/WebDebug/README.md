# WebDebug MCP Server

This directory contains a Model Context Protocol (MCP) server designed to allow an MCP client (like Claude Desktop) to interact with a running Google Chrome instance for debugging purposes.

## Overview

The server (`server.py`) acts as a bridge between the MCP client and the Chrome DevTools Protocol. It exposes resources and tools that the client can use to query or control the browser.

## Setup

1.  **Start Chrome with Remote Debugging Enabled:**
    You need to launch Chrome with a specific flag to open the debugging port. The exact command depends on your operating system:

    *   **macOS:**
        ```bash
        /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
        ```
    *   **Windows:**
        ```cmd
        "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
        ```
    *   **Linux:**
        ```bash
        google-chrome --remote-debugging-port=9222
        ```
    *(Adjust paths if necessary. Ensure no other Chrome instance is using port 9222)*.

2.  **Create a Virtual Environment (Recommended):**
    ```bash
    python3 -m venv venv
    source venv/bin/activate # On Windows use `venv\Scripts\activate`
    ```

3.  **Install Dependencies:**
    Make sure you have uncommented your chosen Chrome Debugging Protocol library (e.g., `websockets`) in `requirements.txt` and update the MCP SDK package name if needed.
    ```bash
    pip install -r requirements.txt
    ```

4.  **Implement Server Logic:**
    *   Open `server.py`.
    *   Replace placeholder comments (`# TODO: ...`) with actual implementation using the MCP SDK and your chosen Chrome debugging library.
    *   Update the MCP resource/tool definitions (`@resource`, `@tool`) according to the MCP SDK documentation.
    *   Implement the connection logic in `_connect_to_chrome`.
    *   Implement the logic for `list_tabs`, `inspect_element`, and any other desired debugging functions.

5.  **Run the Server:**
    ```bash
    python server.py --mcp-port 8080 --chrome-port 9222
    ```
    *(Adjust ports if needed)*

6.  **Connect from MCP Client:**
    Configure your MCP client (e.g., Claude Desktop) to connect to the server running at `http://localhost:8080` (or the host/port you specified).

## Dependencies

See `requirements.txt`. You will need:

*   The official Model Context Protocol SDK for Python.
*   A Python library to communicate with the Chrome DevTools Protocol (e.g., `websockets`).

## Notes

*   This is a skeleton implementation. Significant development is required in `server.py` to make it functional.
*   Refer to the official MCP documentation and the documentation for your chosen Chrome debugging library for implementation details. 