#!/usr/bin/env python3
"""Serve the BattleSystem browser sandbox locally."""

from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8000


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    import os

    os.chdir(root)
    Server = getattr(__import__("http.server", fromlist=["ThreadingHTTPServer"]), "ThreadingHTTPServer", None)
    if Server is None:
        Server = HTTPServer
    server = Server((HOST, PORT), SimpleHTTPRequestHandler)
    print(f"Serving BattleSystem from {root}")
    print(f"Open http://{HOST}:{PORT}/index.html")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
