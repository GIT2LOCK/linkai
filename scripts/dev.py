"""Run LinkAI local API and web frontend together for development."""

from __future__ import annotations

import argparse
import os
import urllib.error
import urllib.request
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT / "frontend"
API_PORT = 8765
FRONTEND_PORT = 5173


def main() -> int:
    """Start both development processes and keep them supervised."""
    parser = argparse.ArgumentParser(description="Run LinkAI dev environment.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Only validate required commands and paths.",
    )
    args = parser.parse_args()
    npm = validate_environment()

    if args.check:
        print("LinkAI dev environment check passed.")
        print(f"Python: {sys.executable}")
        print(f"npm: {npm}")
        print(f"Frontend: {FRONTEND_DIR}")
        return 0

    processes: list[tuple[str, subprocess.Popen[str]]] = []

    try:
        if is_port_open(API_PORT):
            if not is_api_compatible():
                raise RuntimeError(
                    "A API local na porta 8765 esta desatualizada ou incompleta. "
                    "Execute .\\stop-linkai-web.ps1 e depois .\\run-linkai-web.ps1."
                )

            print(f"API already running on http://127.0.0.1:{API_PORT}")
        else:
            processes.append(
                start_process(
                    "api",
                    [
                        sys.executable,
                        "-m",
                        "uvicorn",
                        "backend.api.server:app",
                        "--host",
                        "127.0.0.1",
                        "--port",
                        str(API_PORT),
                        "--reload",
                    ],
                    ROOT,
                )
            )

        if is_port_open(FRONTEND_PORT):
            print(f"Frontend already running on http://127.0.0.1:{FRONTEND_PORT}")
        else:
            processes.append(
                start_process(
                    "web",
                    [npm, "run", "dev:web"],
                    FRONTEND_DIR,
                )
            )
    except Exception:
        stop_processes(processes)
        raise

    print("")
    print("LinkAI dev environment running.")
    print(f"API:      http://127.0.0.1:{API_PORT}")
    print(f"Frontend: http://127.0.0.1:{FRONTEND_PORT}")
    print("Press Ctrl+C to stop processes started by this runner.")
    print("")

    if not processes:
        print("Both services were already running.")
        return 0

    try:
        while True:
            for name, process in processes:
                exit_code = process.poll()

                if exit_code is not None:
                    print(f"{name} stopped with exit code {exit_code}.")
                    stop_processes(processes)
                    return exit_code

            time.sleep(0.5)
    except KeyboardInterrupt:
        print("")
        print("Stopping LinkAI dev environment...")
        stop_processes(processes)
        return 0


def validate_environment() -> str:
    """Validate local development requirements."""
    if not FRONTEND_DIR.is_dir():
        raise RuntimeError(f"Frontend directory not found: {FRONTEND_DIR}")

    npm = find_npm()

    if npm is None:
        raise RuntimeError("npm was not found in PATH.")

    return npm


def find_npm() -> str | None:
    """Find the correct npm executable for the current platform."""
    if os.name == "nt":
        return shutil.which("npm.cmd") or shutil.which("npm")

    return shutil.which("npm")


def is_port_open(port: int) -> bool:
    """Return True when localhost port is already accepting connections."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
        client.settimeout(0.25)
        return client.connect_ex(("127.0.0.1", port)) == 0


def is_api_compatible() -> bool:
    """Return True when the running API exposes routes required by the frontend."""
    if not endpoint_matches("/health", expected_statuses={200}):
        return False

    return endpoint_matches("/uploads/pdfs", expected_statuses={405})


def endpoint_matches(path: str, *, expected_statuses: set[int]) -> bool:
    """Check a local API endpoint without requiring external dependencies."""
    url = f"http://127.0.0.1:{API_PORT}{path}"
    request = urllib.request.Request(url, method="GET")

    try:
        with urllib.request.urlopen(request, timeout=3) as response:
            return response.status in expected_statuses
    except urllib.error.HTTPError as exc:
        return exc.code in expected_statuses
    except OSError:
        return False


def start_process(
    name: str,
    command: list[str],
    cwd: Path,
) -> tuple[str, subprocess.Popen[str]]:
    """Start a supervised process."""
    print(f"Starting {name}: {' '.join(command)}")
    process = subprocess.Popen(command, cwd=cwd, text=True)
    return name, process


def stop_processes(processes: list[tuple[str, subprocess.Popen[str]]]) -> None:
    """Terminate child processes."""
    for name, process in processes:
        if process.poll() is not None:
            continue

        print(f"Stopping {name}...")
        process.terminate()

    for _, process in processes:
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill()


if __name__ == "__main__":
    raise SystemExit(main())
