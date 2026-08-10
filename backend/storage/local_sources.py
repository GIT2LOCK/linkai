"""Local folder and file discovery for PDF processing."""

from __future__ import annotations

from pathlib import Path


class LocalDocumentSource:
    """Discovers local PDFs selected from the desktop frontend."""

    def from_paths(self, paths: list[str], *, recursive: bool = True) -> list[Path]:
        """Return all PDFs represented by selected files or folders."""
        pdfs: list[Path] = []

        for raw_path in paths:
            path = Path(raw_path)

            if path.is_file() and path.suffix.lower() == ".pdf":
                pdfs.append(path)
                continue

            if path.is_dir():
                pattern = "**/*.pdf" if recursive else "*.pdf"
                pdfs.extend(sorted(path.glob(pattern)))

        return sorted({pdf.resolve() for pdf in pdfs})
