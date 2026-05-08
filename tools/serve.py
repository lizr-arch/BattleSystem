#!/usr/bin/env python3
"""Serve the BattleSystem browser sandbox locally."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8000


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    import os

    os.chdir(root)
    server = ThreadingHTTPServer((HOST, PORT), SimpleHTTPRequestHandler)
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
