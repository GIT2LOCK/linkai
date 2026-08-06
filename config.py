"""Centralized runtime configuration for Lumina automation."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Self

from lumina_bot.exceptions import ConfigurationError


PROJECT_ROOT = Path(__file__).resolve().parent
ENV_FILE = PROJECT_ROOT / ".env"


def load_env_file(path: Path = ENV_FILE, *, override: bool = False) -> None:
    """Load key-value pairs from a local .env file into os.environ."""
    if not path.is_file():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")

        if key and (override or key not in os.environ):
            os.environ[key] = value


def _get_float(name: str, default: float) -> float:
    value = os.getenv(name)
    return default if value is None else float(value)


def _get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    return default if value is None else int(value)


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(frozen=True, slots=True)
class AppConfig:
    """Runtime settings shared by the whole automation framework."""

    executable_path: Path
    main_window_title_re: str
    backend: Literal["uia"] = "uia"
    start_timeout: float = 30.0
    connect_timeout: float = 10.0
    window_timeout: float = 20.0
    implicit_timeout: float = 10.0
    retry_interval: float = 0.3
    max_retries: int = 3
    wait_after_click: float = 0.2
    wait_after_set_text: float = 0.1
    screenshot_on_error: bool = False
    logs_dir: Path = PROJECT_ROOT / "logs"
    screenshots_dir: Path = PROJECT_ROOT / "screenshots"

    @property
    def default_timeout(self) -> float:
        """Backward-compatible alias for the framework implicit timeout."""
        return self.implicit_timeout

    @classmethod
    def from_env(cls) -> Self:
        """Build configuration from environment variables.

        Set LUMINA_EXECUTABLE_PATH when the executable is not in the default
        location. Keep LUMINA_MAIN_WINDOW_TITLE_RE broad at first, then tighten
        it when the exact main window title is known.
        """
        executable = os.getenv("LUMINA_EXECUTABLE_PATH", r"C:\Lumina\Lumina.exe")
        title_re = os.getenv("LUMINA_MAIN_WINDOW_TITLE_RE", r".*Lumina.*")

        return cls(
            executable_path=Path(executable),
            main_window_title_re=title_re,
            start_timeout=_get_float("LUMINA_START_TIMEOUT", 30.0),
            connect_timeout=_get_float("LUMINA_CONNECT_TIMEOUT", 10.0),
            window_timeout=_get_float("LUMINA_WINDOW_TIMEOUT", 20.0),
            implicit_timeout=_get_float("LUMINA_IMPLICIT_TIMEOUT", 10.0),
            retry_interval=_get_float("LUMINA_RETRY_INTERVAL", 0.3),
            max_retries=_get_int("LUMINA_MAX_RETRIES", 3),
            wait_after_click=_get_float("LUMINA_WAIT_AFTER_CLICK", 0.2),
            wait_after_set_text=_get_float("LUMINA_WAIT_AFTER_SET_TEXT", 0.1),
            screenshot_on_error=_get_bool("LUMINA_SCREENSHOT_ON_ERROR", False),
        )


@dataclass(frozen=True, slots=True)
class LoginCredentials:
    """Credentials used by the first Lumina login flow."""

    username: str
    password: str

    @classmethod
    def from_env(cls) -> Self:
        """Build credentials from local environment variables."""
        username = os.getenv("LUMINA_USERNAME")
        password = os.getenv("LUMINA_PASSWORD")

        missing = [
            name
            for name, value in {
                "LUMINA_USERNAME": username,
                "LUMINA_PASSWORD": password,
            }.items()
            if not value
        ]

        if missing:
            raise ConfigurationError(
                "Missing required login environment variable(s): "
                + ", ".join(missing)
            )

        return cls(username=str(username), password=str(password))


load_env_file()
DEFAULT_CONFIG = AppConfig.from_env()
