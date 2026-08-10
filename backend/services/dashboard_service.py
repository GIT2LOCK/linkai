"""Dashboard metrics service."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from lumina_bot.config import PROJECT_ROOT

from backend.models.ui import DashboardMetrics


class DashboardService:
    """Builds dashboard metrics without knowing frontend details."""

    def __init__(self, project_root: Path = PROJECT_ROOT) -> None:
        self._root = project_root
        self._output = self._root / "output"

    def metrics(self) -> DashboardMetrics:
        """Return current dashboard metrics."""
        pdfs = list((self._output / "pdfs").rglob("*.pdf"))
        spreadsheets = list((self._output / "excel").glob("*.xlsx"))
        state = self._load_processing_state()
        records = list(state.values())
        success = [record for record in records if record.get("status") == "success"]
        errors = [record for record in records if record.get("status") == "error"]
        last_record = self._last_record(records)

        return DashboardMetrics(
            pdf_count=len(pdfs),
            processed_count=len(success),
            error_count=len(errors),
            spreadsheet_count=len(spreadsheets),
            last_processing=last_record.get("processed_at") if last_record else None,
            last_sync=last_record.get("processed_at") if last_record else None,
            average_time_seconds=None,
            supabase_status=self._supabase_status(),
            used_space_bytes=sum(path.stat().st_size for path in pdfs if path.is_file()),
        )

    def _load_processing_state(self) -> dict[str, dict[str, Any]]:
        state_path = self._output / "temp" / "processing_state.json"

        if not state_path.is_file():
            return {}

        try:
            return json.loads(state_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}

    @staticmethod
    def _last_record(records: list[dict[str, Any]]) -> dict[str, Any] | None:
        dated = [record for record in records if record.get("processed_at")]

        if not dated:
            return None

        return max(dated, key=lambda record: str(record.get("processed_at")))

    @staticmethod
    def _supabase_status() -> str:
        required = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET")
        return "configured" if all(os.getenv(name) for name in required) else "not_configured"
