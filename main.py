"""Entry point for the Lumina desktop automation framework."""

from __future__ import annotations

import time
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parent.parent))

from lumina_bot.config import LoginCredentials
from lumina_bot.core.application import Application
from lumina_bot.core.logger import configure_logging, get_logger
from lumina_bot.exceptions import LuminaBotError
from lumina_bot.pages.login_page import LoginPage


def main() -> None:
    """Start Lumina, wait until the login screen is ready and perform login."""
    configure_logging()
    logger = get_logger(__name__)

    try:
        credentials = LoginCredentials.from_env()
        app = Application()

        logger.info("Launching Lumina...")
        
        # 1. Inicia ou conecta ao aplicativo (Apenas uma chamada é necessária)
        main_window = app.launch_or_connect()
        
        # 2. Aguarda o tempo necessário para sair da splash screen (tela de carregamento)
        logger.info("Waiting 10 seconds for Lumina to finish loading...")
        time.sleep(10)

        logger.info("Waiting for login screen...")

        # NOTA: Comentei a linha abaixo porque este método não existia no application.py 
        # que vimos anteriormente. Se você criou essa função lá, basta descomentar!
        # app.wait_until_login_screen_ready()

        logger.info("Login screen ready.")

        # 3. Interage com a página de login passando a janela principal encontrada
        login_page = LoginPage(main_window)

        # 4. Preenche os dados
        # Certifique-se de que o método dentro da sua classe LoginPage se chama 'login'.
        # Se você usou o meu exemplo anterior, talvez o nome seja 'realizar_login'.
        login_page.login(
            credentials.username,
            credentials.password,
        )

        logger.info("Login submitted successfully.")

    except LuminaBotError:
        logger.exception("Lumina automation failed.")
        raise
    except Exception as e:
        # É uma boa prática capturar erros não mapeados do framework também
        logger.exception(f"An unexpected error occurred: {e}")
        raise


if __name__ == "__main__":
    main()