"""Command bridge used by Tauri IPC to call Python backend services."""

from __future__ import annotations

import json
import sys
from contextlib import redirect_stdout
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.automation import LuminaAutomationService
from backend.core.log_stream import LogStream
from backend.core.result import CommandResult, failure, success
from backend.models.ui import ProcessingOptions
from backend.services import (
    DashboardService,
    DocumentProcessingService,
    HomeService,
    SpreadsheetService,
)
from lumina_bot.config import get_supabase_config
from lumina_bot.core.supabase_client import SupabaseStorageClient


class DesktopBridge:
    """Dispatches frontend commands to backend services."""

    def handle(self, action: str, payload: dict[str, Any]) -> CommandResult:
        """Execute a backend command and return a serializable result."""
        try:
            if action == "dashboard.metrics":
                return success(DashboardService().metrics().to_dict())

            if action == "home.overview":
                return success(HomeService().overview())

            if action == "documents.process":
                options = ProcessingOptions.from_payload(payload)
                return success(DocumentProcessingService().process(options))

            if action == "lumina.start":
                return success(LuminaAutomationService().iniciar_lancamento())

            if action == "spreadsheets.list":
                return success(SpreadsheetService().list_spreadsheets())

            if action == "logs.latest":
                lines = int(payload.get("lines", 300))
                stream = LogStream()
                return success({"path": stream.export_path(), "lines": stream.latest(lines)})

            if action == "supabase.test":
                config = get_supabase_config()
                client = SupabaseStorageClient(config)
                files = client.listar(config.folder)
                return success(
                    {
                        "status": "connected",
                        "bucket": config.bucket,
                        "folder": config.folder,
                        "items": len(files),
                    }
                )

            return failure(f"Unknown action: {action}")
        except Exception as exc:
            return failure(str(exc))


def main() -> None:
    """CLI entry point used by the Tauri Rust shell command."""
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    payload_text = sys.argv[2] if len(sys.argv) > 2 else "{}"

    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError:
        payload = {}

    with redirect_stdout(sys.stderr):
        result = DesktopBridge().handle(action, payload)

    print(json.dumps(result.to_dict(), ensure_ascii=False))


if __name__ == "__main__":
    main()
