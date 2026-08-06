"""Entry point for the Lumina desktop automation framework."""

from __future__ import annotations

import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parent.parent))

from lumina_bot.config import LoginCredentials
from lumina_bot.core.application import Application
from lumina_bot.core.logger import configure_logging, get_logger
from lumina_bot.exceptions import LoginFailed, LuminaBotError
from lumina_bot.pages.login_page import LoginPage


def main() -> None:
    """Start or attach to Lumina, fill credentials, and click OK."""
    configure_logging()
    logger = get_logger(__name__)

    try:
        credentials = LoginCredentials.from_env()
        app = Application()
        main_window = app.launch_or_connect()
        login_page = LoginPage(main_window)

        logger.info("Lumina automation framework initialized.")
        logger.info("Waiting login screen...")

        if not login_page.is_loaded():
            raise LoginFailed("Login screen was not detected.")

        login_page.login(credentials.username, credentials.password)
        logger.info("Login submitted.")
    except LuminaBotError:
        logger.exception("Lumina automation failed.")
        raise


if __name__ == "__main__":
    main()
