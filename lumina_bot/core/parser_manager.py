"""Parser strategy manager."""

from __future__ import annotations

from pathlib import Path

from lumina_bot.core.document_detector import (
    DocumentDetection,
    DocumentDetector,
    DocumentType,
)
from lumina_bot.core.logger import get_logger
from lumina_bot.core.pdf_reader import PdfReadResult
from lumina_bot.models.nota import NotaFiscal
from lumina_bot.parsers import (
    BaseParser,
    BoletoParser,
    CteParser,
    DesconhecidoParser,
    MdfeParser,
    NfceParser,
    NfeParser,
    NfseParser,
    ParseContext,
)


class ParserManager:
    """Selects the right parser strategy for each detected document type."""

    def __init__(self, detector: DocumentDetector | None = None) -> None:
        self._detector = detector or DocumentDetector()
        self._logger = get_logger(self.__class__.__name__)
        self._parsers: dict[DocumentType, BaseParser] = {
            DocumentType.NFE: NfeParser(),
            DocumentType.NFSE: NfseParser(),
            DocumentType.NFCE: NfceParser(),
            DocumentType.CTE: CteParser(),
            DocumentType.MDFE: MdfeParser(),
            DocumentType.BOLETO: BoletoParser(),
            DocumentType.DESCONHECIDO: DesconhecidoParser(),
        }

    def parse(
        self,
        pdf: PdfReadResult,
        *,
        remote_path: str | None = None,
        xml_text: str | None = None,
        xml_local_path: Path | None = None,
    ) -> NotaFiscal:
        """Detect and parse a PDF result into a NotaFiscal object."""
        detection = self.detect(pdf)
        parser = self._parsers.get(
            detection.document_type,
            self._parsers[DocumentType.DESCONHECIDO],
        )
        self._logger.info(
            "Parser selected: %s | type=%s | confidence=%s",
            parser.parser_name,
            detection.document_type.value,
            detection.confidence,
        )
        context = ParseContext(
            text=pdf.text,
            file_name=pdf.path.name,
            detection=detection,
            pdf=pdf,
            remote_path=remote_path,
            local_path=str(pdf.path),
            xml_text=xml_text,
            xml_local_path=str(xml_local_path) if xml_local_path else None,
        )
        return parser.parse(context)

    def detect(self, pdf: PdfReadResult) -> DocumentDetection:
        """Detect document type from the PDF text."""
        return self._detector.detect(pdf.text, pdf.path.name)
