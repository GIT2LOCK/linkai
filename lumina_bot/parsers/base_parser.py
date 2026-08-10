"""Base parser strategy for fiscal documents."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from abc import ABC
from dataclasses import dataclass
from typing import ClassVar

from lumina_bot.core.document_detector import DocumentDetection, DocumentType
from lumina_bot.core.pdf_reader import PdfReadResult
from lumina_bot.models.nota import NotaFiscal


@dataclass(frozen=True, slots=True)
class ParseContext:
    """Input context passed to parser strategies."""

    text: str
    file_name: str
    detection: DocumentDetection
    pdf: PdfReadResult
    remote_path: str | None = None
    local_path: str | None = None
    xml_text: str | None = None
    xml_local_path: str | None = None


class BaseParser(ABC):
    """Base strategy with common extraction helpers."""

    document_type: ClassVar[DocumentType] = DocumentType.DESCONHECIDO
    parser_name: ClassVar[str] = "base"

    COMMON_LABELS: ClassVar[dict[str, tuple[str, ...]]] = {
        "numero": ("numero", "no.", "nro", "nota fiscal n"),
        "serie": ("serie", "serie da nota"),
        "modelo": ("modelo", "mod"),
        "protocolo": ("protocolo", "protocolo de autorizacao"),
        "autorizacao": ("autorizacao", "codigo de verificacao"),
        "data_emissao": ("data de emissao", "emissao", "data emissao"),
        "hora_emissao": ("hora de emissao", "hora emissao"),
        "competencia": ("competencia", "mes de competencia"),
        "razao_social": ("razao social", "nome empresarial"),
        "nome_fantasia": ("nome fantasia",),
        "municipio": ("municipio", "cidade"),
        "uf": ("uf", "estado"),
        "codigo_municipio": ("codigo municipio", "cod municipio"),
        "codigo_servico": ("codigo do servico", "codigo servico", "cod servico"),
        "descricao_servico": ("descricao do servico", "descricao servico"),
        "discriminacao": ("discriminacao", "descricao dos servicos"),
        "valor_bruto": ("valor bruto", "valor dos servicos", "valor total"),
        "valor_liquido": ("valor liquido", "valor liquido da nota"),
        "base_calculo": ("base de calculo", "base calculo"),
        "aliquota": ("aliquota",),
        "iss": ("iss", "valor iss"),
        "inss": ("inss",),
        "pis": ("pis",),
        "cofins": ("cofins",),
        "csll": ("csll",),
        "irrf": ("irrf", "imposto de renda"),
        "retencoes": ("retencoes", "outras retencoes"),
        "descontos": ("descontos", "desconto"),
        "observacoes": ("observacoes", "informacoes complementares"),
    }

    MONEY_FIELDS: ClassVar[set[str]] = {
        "valor_bruto",
        "valor_liquido",
        "base_calculo",
        "aliquota",
        "iss",
        "inss",
        "pis",
        "cofins",
        "csll",
        "irrf",
        "retencoes",
        "descontos",
    }

    def parse(self, context: ParseContext) -> NotaFiscal:
        """Parse text/XML into a normalized fiscal document."""
        nota = NotaFiscal(
            tipo_documento=self.document_type.value,
            parser=self.parser_name,
            arquivo=context.file_name,
            caminho_remoto=context.remote_path,
            caminho_local=context.local_path,
            caminho_xml_local=context.xml_local_path,
            sha256=context.pdf.sha256,
            tamanho_bytes=context.pdf.size_bytes,
            quantidade_paginas=context.pdf.page_count,
            ocr_required=context.pdf.ocr_required,
            autor_pdf=context.pdf.author,
            criador_pdf=context.pdf.creator,
            producer_pdf=context.pdf.producer,
            metadados_pdf=context.pdf.metadata,
        )

        self._apply_common_fields(nota, context.text)

        if context.xml_text:
            self._apply_xml_fields(nota, context.xml_text)

        self._parse_specific(nota, context)
        return nota

    def _parse_specific(self, nota: NotaFiscal, context: ParseContext) -> None:
        """Hook for concrete parsers."""

    def _apply_common_fields(self, nota: NotaFiscal, text: str) -> None:
        lines = self._lines(text)

        nota.chave = self._extract_key(text)
        nota.prestador.cnpj = self._first_cnpj(text)
        nota.prestador.cpf = self._first_cpf(text)

        for field_name, labels in self.COMMON_LABELS.items():
            value = self._value_after_labels(lines, labels)

            if value is None:
                continue

            if field_name in self.MONEY_FIELDS:
                parsed_value = self._parse_decimal(value)
                self._set_money_field(nota, field_name, parsed_value)
            elif hasattr(nota, field_name):
                setattr(nota, field_name, value)
            else:
                nota.outros_campos[field_name] = value

        nota.prestador.razao_social = nota.prestador.razao_social or self._value_after_labels(
            lines,
            ("prestador", "emitente", "razao social"),
        )
        nota.tomador.razao_social = nota.tomador.razao_social or self._value_after_labels(
            lines,
            ("tomador", "destinatario", "sacado"),
        )

    def _apply_xml_fields(self, nota: NotaFiscal, xml_text: str) -> None:
        try:
            root = ET.fromstring(xml_text.encode("utf-8"))
        except ET.ParseError:
            nota.outros_campos["xml_parse_error"] = "invalid xml"
            return

        values = self._flatten_xml(root)

        nota.numero = nota.numero or self._first_xml(values, "nnf", "numero", "nnota")
        nota.serie = nota.serie or self._first_xml(values, "serie")
        nota.modelo = nota.modelo or self._first_xml(values, "mod", "modelo")
        nota.chave = nota.chave or self._xml_key(values)
        nota.data_emissao = nota.data_emissao or self._first_xml(
            values,
            "dhemi",
            "demi",
            "dataemissao",
        )
        nota.valor_total = nota.valor_total or self._parse_decimal(
            self._first_xml(values, "vNF", "vserv", "valorservicos")
        )
        nota.valor_bruto = nota.valor_bruto or nota.valor_total
        nota.prestador.cnpj = nota.prestador.cnpj or self._first_xml(values, "cnpj")
        nota.prestador.cpf = nota.prestador.cpf or self._first_xml(values, "cpf")
        nota.prestador.razao_social = nota.prestador.razao_social or self._first_xml(
            values,
            "xnome",
            "razaosocial",
        )
        nota.prestador.nome_fantasia = nota.prestador.nome_fantasia or self._first_xml(
            values,
            "xfant",
            "nomefantasia",
        )
        nota.codigo_servico = nota.codigo_servico or self._first_xml(
            values,
            "cservico",
            "itemlistaservico",
        )
        nota.descricao_servico = nota.descricao_servico or self._first_xml(
            values,
            "xserv",
            "discriminacao",
        )
        nota.outros_campos["xml_campos_extraidos"] = values

    def _set_money_field(
        self,
        nota: NotaFiscal,
        field_name: str,
        value: float | None,
    ) -> None:
        if value is None:
            return

        if hasattr(nota, field_name):
            setattr(nota, field_name, value)
        elif hasattr(nota.tributos, field_name):
            setattr(nota.tributos, field_name, value)

    @staticmethod
    def _lines(text: str) -> list[str]:
        return [line.strip() for line in text.splitlines() if line.strip()]

    def _value_after_labels(
        self,
        lines: list[str],
        labels: tuple[str, ...],
    ) -> str | None:
        normalized_labels = tuple(self._normalize(label) for label in labels)

        for index, line in enumerate(lines):
            normalized_line = self._normalize(line)

            for label in normalized_labels:
                if label not in normalized_line:
                    continue

                same_line = self._after_separator(line)

                if same_line:
                    return same_line

                if index + 1 < len(lines):
                    return lines[index + 1].strip()

        return None

    @staticmethod
    def _after_separator(line: str) -> str | None:
        for separator in (":", "-", "="):
            if separator in line:
                value = line.split(separator, 1)[1].strip()
                return value or None

        return None

    @staticmethod
    def _normalize(value: str) -> str:
        normalized = value.lower().replace("\xa0", " ")
        replacements = {
            "á": "a",
            "à": "a",
            "ã": "a",
            "â": "a",
            "é": "e",
            "ê": "e",
            "í": "i",
            "ó": "o",
            "õ": "o",
            "ô": "o",
            "ú": "u",
            "ç": "c",
        }

        for source, target in replacements.items():
            normalized = normalized.replace(source, target)

        return " ".join(normalized.split())

    @staticmethod
    def _first_cnpj(text: str) -> str | None:
        match = re.search(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b", text)
        return match.group(0) if match else None

    @staticmethod
    def _first_cpf(text: str) -> str | None:
        match = re.search(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", text)
        return match.group(0) if match else None

    @staticmethod
    def _extract_key(text: str) -> str | None:
        compact = re.sub(r"\D", "", text)
        match = re.search(r"\d{44}", compact)
        return match.group(0) if match else None

    @staticmethod
    def _parse_decimal(value: str | None) -> float | None:
        if value is None:
            return None

        match = re.search(r"-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:\.\d+)?", value)

        if not match:
            return None

        number = match.group(0)

        if "," in number:
            number = number.replace(".", "").replace(",", ".")

        try:
            return float(number)
        except ValueError:
            return None

    @staticmethod
    def _flatten_xml(root: ET.Element) -> dict[str, str]:
        values: dict[str, str] = {}

        for element in root.iter():
            tag = element.tag.rsplit("}", 1)[-1].lower()
            text = (element.text or "").strip()

            if text and tag not in values:
                values[tag] = text

            for attribute_name, attribute_value in element.attrib.items():
                attribute_key = f"{tag}_{attribute_name.lower()}"

                if attribute_value and attribute_key not in values:
                    values[attribute_key] = attribute_value

        return values

    @staticmethod
    def _first_xml(values: dict[str, str], *names: str) -> str | None:
        for name in names:
            value = values.get(name.lower())

            if value:
                return value

        return None

    @staticmethod
    def _xml_key(values: dict[str, str]) -> str | None:
        for key in ("chnfe", "chcte", "chmdfe"):
            value = values.get(key)

            if value:
                return value

        for value in values.values():
            digits = re.sub(r"\D", "", value)

            if len(digits) >= 44:
                return digits[:44]

        return None
