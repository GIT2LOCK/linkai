"""Document processing service for Supabase, folders, and selected files."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from lumina_bot.config import PROJECT_ROOT
from lumina_bot.core.excel_writer import ExcelWriter
from lumina_bot.core.parser_manager import ParserManager
from lumina_bot.core.pdf_reader import PdfReader
from lumina_bot.core.processor import Processor
from lumina_bot.core.storage import StorageService
from lumina_bot.models.nota import NotaFiscal

from backend.models.ui import ProcessingOptions
from backend.storage.local_sources import LocalDocumentSource


class DocumentProcessingService:
    """Coordinates document processing use cases requested by the UI."""

    def __init__(self) -> None:
        self._local_source = LocalDocumentSource()
        self._pdf_reader = PdfReader()
        self._parser_manager = ParserManager()

    def process(self, options: ProcessingOptions) -> dict[str, Any]:
        """Process documents from the selected source."""
        if options.source == "supabase":
            return self._process_supabase()

        return self._process_local(options)

    def _process_supabase(self) -> dict[str, Any]:
        summary = Processor().run()
        return {
            "source": "supabase",
            "summary": {
                "listed": summary.listed,
                "processed": summary.processed,
                "ignored": summary.ignored,
                "failed": summary.failed,
                "duplicated": summary.duplicated,
            },
        }

    def _process_local(self, options: ProcessingOptions) -> dict[str, Any]:
        started = time.perf_counter()
        pdf_paths = self._local_source.from_paths(
            options.paths,
            recursive=options.process_subfolders,
        )
        notas: list[NotaFiscal] = []
        rows: list[dict[str, Any]] = []
        failed = 0

        for path in pdf_paths:
            try:
                pdf = self._pdf_reader.read(path)
                nota = self._parser_manager.parse(pdf, remote_path=None)
                nota.status_processamento = "success"
                notas.append(nota)
                rows.append(self._row_from_nota(nota, "local", "success"))
            except Exception as exc:
                failed += 1
                rows.append(
                    {
                        "name": path.name,
                        "type": "PDF",
                        "pageCount": None,
                        "sizeBytes": path.stat().st_size if path.is_file() else None,
                        "status": "error",
                        "source": "local",
                        "hash": None,
                        "documentType": None,
                        "parser": None,
                        "error": str(exc),
                        "progress": 100,
                    }
                )

        if options.generate_excel and notas:
            writer = ExcelWriter(PROJECT_ROOT / "output" / "excel" / "notas.xlsx")
            writer.write(notas, mode=options.excel_mode)

        elapsed = time.perf_counter() - started
        return {
            "source": options.source,
            "rows": rows,
            "summary": {
                "listed": len(pdf_paths),
                "processed": len(notas),
                "ignored": 0,
                "failed": failed,
                "duplicated": 0,
                "elapsedSeconds": elapsed,
            },
        }

    @staticmethod
    def _row_from_nota(
        nota: NotaFiscal,
        source: str,
        status: str,
    ) -> dict[str, Any]:
        return {
            "name": nota.arquivo,
            "type": "PDF",
            "pageCount": nota.quantidade_paginas,
            "sizeBytes": nota.tamanho_bytes,
            "status": status,
            "source": source,
            "hash": nota.sha256,
            "documentType": nota.tipo_documento,
            "parser": nota.parser,
            "error": nota.erro_processamento,
            "progress": 100,
        }
