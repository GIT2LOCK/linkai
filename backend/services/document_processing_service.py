"""Document processing service for Supabase, folders, and selected files."""

from __future__ import annotations

import shutil
import time
from dataclasses import replace
from pathlib import Path
from typing import Any

from lumina_bot.config import PROJECT_ROOT, get_supabase_config
from lumina_bot.core.excel_writer import ExcelWriter
from lumina_bot.core.logger import get_logger
from lumina_bot.core.parser_manager import ParserManager
from lumina_bot.core.pdf_reader import PdfReader
from lumina_bot.core.processor import Processor
from lumina_bot.core.storage import StorageService
from lumina_bot.models.nota import NotaFiscal

from backend.models.ui import ProcessingOptions
from backend.services.processing_ui_registry import ProcessingUiRegistry
from backend.storage.local_sources import LocalDocumentSource


class DocumentProcessingService:
    """Coordinates document processing use cases requested by the UI."""

    def __init__(self) -> None:
        self._local_source = LocalDocumentSource()
        self._pdf_reader = PdfReader()
        self._parser_manager = ParserManager()
        self._registry = ProcessingUiRegistry()
        self._logger = get_logger(self.__class__.__name__)

    def process(self, options: ProcessingOptions) -> dict[str, Any]:
        """Process documents from the selected source."""
        download_dir = self._resolve_download_dir(options)

        if options.source == "supabase":
            return self._process_supabase(options, download_dir)

        return self._process_local(options, download_dir)

    def last_processing(self) -> dict[str, Any] | None:
        """Return the last processing response persisted for the UI."""
        return self._registry.last_processing()

    def list_files(self) -> list[dict[str, Any]]:
        """Return files registered by previous processing sessions."""
        return self._registry.list_files()

    def list_history(self) -> list[dict[str, Any]]:
        """Return processing history registered by previous sessions."""
        return self._registry.list_history()

    def default_download_path(self) -> dict[str, str]:
        """Return the backend default download folder."""
        return {"path": str(self._registry.default_download_path)}

    def _process_supabase(
        self,
        options: ProcessingOptions,
        download_dir: Path,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        config = replace(get_supabase_config(), pdf_download_path=download_dir)
        summary = Processor(config=config).run()
        elapsed = time.perf_counter() - started
        response = {
            "source": "supabase",
            "rows": [],
            "summary": {
                "listed": summary.listed,
                "processed": summary.processed,
                "ignored": summary.ignored,
                "failed": summary.failed,
                "duplicated": summary.duplicated,
                "elapsedSeconds": elapsed,
            },
        }
        return self._registry.save_processing(
            response=response,
            file_records=[],
            source=options.source,
            download_path=download_dir,
            download_label=options.download_path_label,
        )

    def _process_local(
        self,
        options: ProcessingOptions,
        download_dir: Path,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        pdf_paths = self._local_source.from_paths(
            options.paths,
            recursive=options.process_subfolders,
        )
        notas: list[NotaFiscal] = []
        rows: list[dict[str, Any]] = []
        file_records: list[dict[str, Any]] = []
        failed = 0
        duplicated = 0

        for source_path in pdf_paths:
            source_hash = self._safe_sha256(source_path)

            if options.ignore_duplicates and self._registry.has_success_hash(source_hash):
                duplicated += 1
                row = self._duplicate_row(source_path, source_hash, options.source)
                rows.append(row)
                file_records.append(
                    self._file_record_from_row(row, source_path, source_path)
                )
                self._logger.info("PDF duplicated and ignored: %s", source_path)
                continue

            try:
                working_path = source_path
                downloaded = False

                if options.download_pdfs_locally:
                    working_path, downloaded = self._copy_pdf_to_download_dir(
                        source_path,
                        download_dir,
                        source_hash,
                    )

                pdf = self._pdf_reader.read(working_path)
                nota = self._parser_manager.parse(pdf, remote_path=None)
                nota.status_processamento = "success"
                nota.caminho_local = str(working_path)
                notas.append(nota)

                row = self._row_from_nota(nota, options.source, "success")
                row["originPath"] = str(source_path)
                row["path"] = str(working_path)
                row["downloadedPath"] = str(working_path) if options.download_pdfs_locally else None
                row["downloaded"] = options.download_pdfs_locally and downloaded
                rows.append(row)
                file_records.append(
                    self._file_record_from_row(row, source_path, working_path)
                )
                self._logger.info(
                    "PDF processed: %s | hash=%s | destination=%s",
                    source_path,
                    row.get("hash"),
                    working_path,
                )
            except Exception as exc:
                failed += 1
                row = self._error_row(source_path, source_hash, options.source, str(exc))
                rows.append(row)
                file_records.append(
                    self._file_record_from_row(row, source_path, source_path)
                )
                self._logger.exception("PDF failed and will be skipped: %s", source_path)

        if options.generate_excel and notas:
            writer = ExcelWriter(PROJECT_ROOT / "output" / "excel" / "notas.xlsx")
            writer.write(notas, mode=options.excel_mode)

        elapsed = time.perf_counter() - started
        response = {
            "source": options.source,
            "rows": rows,
            "summary": {
                "listed": len(pdf_paths),
                "processed": len(notas),
                "ignored": 0,
                "failed": failed,
                "duplicated": duplicated,
                "elapsedSeconds": elapsed,
            },
        }
        return self._registry.save_processing(
            response=response,
            file_records=file_records,
            source=options.source,
            download_path=download_dir,
            download_label=options.download_path_label,
        )

    def _resolve_download_dir(self, options: ProcessingOptions) -> Path:
        raw_path = options.download_path

        if raw_path:
            download_dir = Path(raw_path).expanduser()
            if not download_dir.is_absolute():
                download_dir = PROJECT_ROOT / download_dir
        else:
            download_dir = self._registry.default_download_path

        download_dir.mkdir(parents=True, exist_ok=True)
        return download_dir

    def _copy_pdf_to_download_dir(
        self,
        source_path: Path,
        download_dir: Path,
        source_hash: str | None,
    ) -> tuple[Path, bool]:
        destination = download_dir / source_path.name

        if self._same_path(source_path, destination):
            return source_path, False

        if destination.is_file():
            destination_hash = self._safe_sha256(destination)

            if source_hash and destination_hash == source_hash:
                return destination, False

            destination = self._unique_destination(destination, source_hash)

        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, destination)
        return destination, True

    @staticmethod
    def _unique_destination(destination: Path, source_hash: str | None) -> Path:
        suffix = (source_hash or "copy")[:8]
        candidate = destination.with_name(
            f"{destination.stem}_{suffix}{destination.suffix}"
        )
        counter = 2

        while candidate.exists():
            candidate = destination.with_name(
                f"{destination.stem}_{suffix}_{counter}{destination.suffix}"
            )
            counter += 1

        return candidate

    @staticmethod
    def _same_path(first: Path, second: Path) -> bool:
        try:
            return first.resolve() == second.resolve()
        except OSError:
            return False

    @staticmethod
    def _safe_sha256(path: Path) -> str | None:
        try:
            return StorageService.sha256_file(path)
        except OSError:
            return None

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

    @staticmethod
    def _duplicate_row(
        path: Path,
        sha256: str | None,
        source: str,
    ) -> dict[str, Any]:
        return {
            "name": path.name,
            "type": "PDF",
            "pageCount": None,
            "sizeBytes": path.stat().st_size if path.is_file() else None,
            "status": "duplicated",
            "source": source,
            "hash": sha256,
            "documentType": None,
            "parser": None,
            "error": None,
            "progress": 100,
            "originPath": str(path),
            "path": str(path),
            "downloadedPath": None,
            "downloaded": False,
        }

    @staticmethod
    def _error_row(
        path: Path,
        sha256: str | None,
        source: str,
        error: str,
    ) -> dict[str, Any]:
        return {
            "name": path.name,
            "type": "PDF",
            "pageCount": None,
            "sizeBytes": path.stat().st_size if path.is_file() else None,
            "status": "error",
            "source": source,
            "hash": sha256,
            "documentType": None,
            "parser": None,
            "error": error,
            "progress": 100,
            "originPath": str(path),
            "path": str(path),
            "downloadedPath": None,
            "downloaded": False,
        }

    @staticmethod
    def _file_record_from_row(
        row: dict[str, Any],
        source_path: Path,
        local_path: Path,
    ) -> dict[str, Any]:
        return {
            "id": row.get("hash") or str(local_path),
            "name": row.get("name") or local_path.name,
            "type": "PDF",
            "path": str(local_path),
            "originPath": str(source_path),
            "sizeBytes": row.get("sizeBytes"),
            "hash": row.get("hash"),
            "source": row.get("source"),
            "documentType": row.get("documentType"),
            "parser": row.get("parser"),
            "pageCount": row.get("pageCount"),
            "status": row.get("status"),
            "error": row.get("error"),
            "modifiedAt": (
                time.strftime(
                    "%Y-%m-%dT%H:%M:%S",
                    time.localtime(local_path.stat().st_mtime),
                )
                if local_path.is_file()
                else None
            ),
        }
