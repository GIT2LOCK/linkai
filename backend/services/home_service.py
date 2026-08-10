"""Home page data service for LinkAI."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


@dataclass(frozen=True, slots=True)
class WorkUpdate:
    """Curated Linka Engenharia work update shown on the home page."""

    title: str
    category: str
    summary: str
    meta: str
    progress: int | None
    source_url: str


@dataclass(frozen=True, slots=True)
class MarketQuote:
    """Market quote normalized for frontend rendering."""

    symbol: str
    name: str
    price: float | None
    change_percent: float | None
    currency: str
    source: str


@dataclass(frozen=True, slots=True)
class CurrencyQuote:
    """Currency quote against BRL."""

    code: str
    name: str
    bid: float | None
    change_percent: float | None
    source: str


class HomeService:
    """Build the LinkAI home page overview."""

    _YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
    _AWESOME_API_URL = "https://economia.awesomeapi.com.br/json/last"

    _STOCKS: tuple[tuple[str, str], ...] = (
        ("CYRE3.SA", "Cyrela"),
        ("MRVE3.SA", "MRV"),
        ("EZTC3.SA", "EZTEC"),
        ("EVEN3.SA", "Even"),
        ("DIRR3.SA", "Direcional"),
        ("TEND3.SA", "Tenda"),
        ("CURY3.SA", "Cury"),
        ("LAVV3.SA", "Lavvi"),
        ("TRIS3.SA", "Trisul"),
        ("JHSF3.SA", "JHSF"),
    )

    _CURRENCIES: tuple[tuple[str, str], ...] = (
        ("USD-BRL", "Dólar americano"),
        ("EUR-BRL", "Euro"),
        ("GBP-BRL", "Libra esterlina"),
        ("JPY-BRL", "Iene japonês"),
        ("CHF-BRL", "Franco suíço"),
        ("CAD-BRL", "Dólar canadense"),
        ("AUD-BRL", "Dólar australiano"),
        ("CNY-BRL", "Yuan chinês"),
        ("BTC-BRL", "Bitcoin"),
        ("ETH-BRL", "Ethereum"),
    )

    _WORK_UPDATES: tuple[WorkUpdate, ...] = (
        WorkUpdate(
            title="Gabriel 2555",
            category="Obra concluída",
            summary=(
                "Empreendimento comercial da Gabripar / Linka com arquitetura "
                "Gui Mattos e entrega informada para 09/2025."
            ),
            meta="Jardim América, São Paulo - 3.271 m² construídos",
            progress=100,
            source_url="https://linka.eng.br/obra-gabriel/",
        ),
        WorkUpdate(
            title="Groenlândia",
            category="Projeto em andamento",
            summary=(
                "Projeto comercial da Zagros Capital com arquitetura Aflalo e "
                "Gasperini, atualizado no site da Linka em maio/2026."
            ),
            meta="Jardim América, São Paulo - 3.684 m² construídos",
            progress=74,
            source_url="https://linka.eng.br/projeto-groelandia/",
        ),
        WorkUpdate(
            title="Itacema / Renato",
            category="Obra em andamento",
            summary=(
                "Empreendimento da Idea Zarvos, Hedge e Paladin com construção "
                "Linka e arquitetura Bernardes."
            ),
            meta="Portfólio de obras em andamento",
            progress=None,
            source_url="https://linka.eng.br/obras/",
        ),
        WorkUpdate(
            title="Fonseca Rodrigues",
            category="Obra em andamento",
            summary=(
                "Projeto Toca 55 com construção Linka e arquitetura Triptyque "
                "Architecture."
            ),
            meta="Portfólio de obras em andamento",
            progress=None,
            source_url="https://linka.eng.br/obras/",
        ),
    )

    def overview(self) -> dict[str, Any]:
        """Return home page data in a frontend-friendly shape."""
        return {
            "updatedAt": datetime.now(UTC).isoformat(),
            "workUpdates": [asdict(item) for item in self._WORK_UPDATES],
            "marketQuotes": [asdict(item) for item in self._market_quotes()],
            "currencyQuotes": [asdict(item) for item in self._currency_quotes()],
        }

    def _market_quotes(self) -> list[MarketQuote]:
        quotes: list[MarketQuote] = []

        for symbol, fallback_name in self._STOCKS:
            quotes.append(self._fetch_market_quote(symbol, fallback_name))

        return quotes

    def _fetch_market_quote(self, symbol: str, fallback_name: str) -> MarketQuote:
        url = (
            f"{self._YAHOO_CHART_URL}/{symbol}?"
            f"{urlencode({'range': '5d', 'interval': '1d'})}"
        )

        try:
            payload = self._fetch_json(url)
            result = payload.get("chart", {}).get("result", [])[0]
            meta = result.get("meta", {})
            price = self._float_or_none(meta.get("regularMarketPrice"))
            previous_close = self._float_or_none(meta.get("chartPreviousClose"))
            change_percent = self._change_percent(price, previous_close)

            return MarketQuote(
                symbol=symbol.replace(".SA", ""),
                name=fallback_name,
                price=price,
                change_percent=change_percent,
                currency=str(meta.get("currency") or "BRL"),
                source="Yahoo Finance",
            )
        except (
            IndexError,
            KeyError,
            OSError,
            TimeoutError,
            URLError,
            json.JSONDecodeError,
        ):
            return MarketQuote(
                symbol=symbol.replace(".SA", ""),
                name=fallback_name,
                price=None,
                change_percent=None,
                currency="BRL",
                source="Fallback",
            )

    def _currency_quotes(self) -> list[CurrencyQuote]:
        pairs = ",".join(code for code, _ in self._CURRENCIES)
        url = f"{self._AWESOME_API_URL}/{pairs}"

        try:
            payload = self._fetch_json(url)
        except (OSError, TimeoutError, URLError, json.JSONDecodeError):
            payload = {}

        quotes: list[CurrencyQuote] = []

        for pair, fallback_name in self._CURRENCIES:
            key = pair.replace("-", "")
            raw = payload.get(key, {})
            code = pair.split("-")[0]
            quotes.append(
                CurrencyQuote(
                    code=code,
                    name=str(raw.get("name") or fallback_name),
                    bid=self._float_or_none(raw.get("bid")),
                    change_percent=self._float_or_none(raw.get("pctChange")),
                    source="AwesomeAPI" if raw else "Fallback",
                )
            )

        return quotes

    @staticmethod
    def _fetch_json(url: str) -> dict[str, Any]:
        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "LinkAI/0.2 Mozilla/5.0",
            },
        )

        with urlopen(request, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))

    @staticmethod
    def _float_or_none(value: object) -> float | None:
        if value in {None, ""}:
            return None

        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _change_percent(
        current: float | None,
        previous_close: float | None,
    ) -> float | None:
        if current is None or previous_close in {None, 0}:
            return None

        return ((current - previous_close) / previous_close) * 100
