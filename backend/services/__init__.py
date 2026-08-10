"""Backend services exposed to API and IPC layers."""

from __future__ import annotations

from backend.services.dashboard_service import DashboardService
from backend.services.document_processing_service import DocumentProcessingService
from backend.services.spreadsheet_service import SpreadsheetService

__all__ = [
    "DashboardService",
    "DocumentProcessingService",
    "SpreadsheetService",
]
