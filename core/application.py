"""Application lifecycle management for Lumina."""

from __future__ import annotations

import os
from pathlib import Path

from pywinauto import Desktop
from pywinauto.application import Application as PywinautoApplication
from pywinauto.application import WindowSpecification

from lumina_bot.config import AppConfig, DEFAULT_CONFIG
from lumina_bot.core.logger import get_logger
from lumina_bot.exceptions import (
    ApplicationConnectionError,
    ApplicationStartError,
    ConfigurationError,
    WindowNotFound,
)

SHELL_LAUNCHER_SUFFIXES = {".appref-ms", ".lnk", ".url"}


class Application:
    """Starts, connects to, and exposes the main Lumina window."""

    def __init__(self, config: AppConfig = DEFAULT_CONFIG) -> None:
        self._config = config
        self.app: PywinautoApplication | None = None
        self.main_window: WindowSpecification | None = None
        self._logger = get_logger(self.__class__.__name__)

    def launch_or_connect(self) -> WindowSpecification:
        """Attach to a running Lumina instance or start a new one."""
        try:
            return self.connect()
        except ApplicationConnectionError:
            self._logger.info("No running Lumina instance found.")
            return self.start()

    def start(self) -> WindowSpecification:
        """Start Lumina from the configured executable or shell launcher."""
        launcher_path = self._config.executable_path
        self._validate_launcher_path(launcher_path)

        self._logger.info("Opening Lumina from %s...", launcher_path)

        try:
            if self._is_shell_launcher(launcher_path):
                self._start_with_windows_shell(launcher_path)
            else:
                self.app = PywinautoApplication(backend=self._config.backend).start(
                    str(launcher_path),
                    timeout=self._config.start_timeout,
                )
        except Exception as exc:  # pywinauto raises different backend errors.
            raise ApplicationStartError(
                f"Could not start Lumina from '{launcher_path}'."
            ) from exc

        self.main_window = self._locate_main_window(self._config.window_timeout)
        self._connect_to_window(self.main_window)
        return self.get_main_window()

    def connect(self) -> WindowSpecification:
        """Connect to Lumina when its main window is already open."""
        self._logger.info("Connecting to existing Lumina process...")

        try:
            desktop = Desktop(backend=self._config.backend)
            window_spec = desktop.window(title_re=self._config.main_window_title_re)

            if not window_spec.exists(
                timeout=self._config.connect_timeout,
                retry_interval=self._config.retry_interval,
            ):
                raise ApplicationConnectionError(
                    "No running Lumina window matched the configured title regex."
                )

            self._connect_to_window(window_spec)
            self.main_window = self._locate_main_window(self._config.window_timeout)
            return self.get_main_window()
        except ApplicationConnectionError:
            raise
        except Exception as exc:
            raise ApplicationConnectionError(
                "Could not connect to the running Lumina instance."
            ) from exc

    def get_main_window(self) -> WindowSpecification:
        """Return the cached main window or raise a framework exception."""
        if self.main_window is None:
            raise WindowNotFound(
                "Main window is not available. Call launch_or_connect() first."
            )

        return self.main_window

    def _locate_main_window(self, timeout: float) -> WindowSpecification:
        """Find and cache the main Lumina window."""
        try:
            desktop = Desktop(backend=self._config.backend)
            window_spec = desktop.window(title_re=self._config.main_window_title_re)

            if not window_spec.exists(
                timeout=timeout,
                retry_interval=self._config.retry_interval,
            ):
                raise WindowNotFound(
                    "Lumina main window was not found within the configured timeout."
                )

            window_spec.wait(
                "visible",
                timeout=timeout,
                retry_interval=self._config.retry_interval,
            )

            self._logger.info("Window found.")
            return window_spec
        except WindowNotFound:
            raise
        except Exception as exc:
            raise WindowNotFound(
                "Failed while locating the Lumina main window."
            ) from exc

    @staticmethod
    def _validate_launcher_path(launcher_path: Path) -> None:
        if not launcher_path.is_file():
            raise ConfigurationError(
                "Lumina launcher was not found. Set LUMINA_EXECUTABLE_PATH "
                f"or update config.py. Current value: '{launcher_path}'."
            )

    @staticmethod
    def _is_shell_launcher(launcher_path: Path) -> bool:
        return launcher_path.suffix.lower() in SHELL_LAUNCHER_SUFFIXES

    def _start_with_windows_shell(self, launcher_path: Path) -> None:
        """Open ClickOnce and shortcut launchers through Windows Shell."""
        self._logger.info("Opening Lumina through Windows Shell launcher...")
        os.startfile(str(launcher_path))

    def _connect_to_window(self, window_spec: WindowSpecification) -> None:
        """Attach pywinauto Application to an already located window."""
        window = window_spec.wrapper_object()
        self.app = PywinautoApplication(backend=self._config.backend).connect(
            handle=window.handle
        )
