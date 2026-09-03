import base64
import hashlib
import unittest

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from lumina_bot.config import decrypt_lumina_secret


def encode_base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


class LuminaCredentialTests(unittest.TestCase):
    def test_decrypts_the_v1_format_used_by_linkai_server(self) -> None:
        secret = "test-shared-secret"
        plaintext = "usuario-lumina:senha-com-caracteres-ç"
        iv = bytes(range(12))
        key = hashlib.sha256(secret.encode("utf-8")).digest()
        encrypted = AESGCM(key).encrypt(iv, plaintext.encode("utf-8"), None)
        payload, tag = encrypted[:-16], encrypted[-16:]
        ciphertext = ":".join(
            [
                "v1",
                encode_base64url(iv),
                encode_base64url(tag),
                encode_base64url(payload),
            ]
        )

        self.assertEqual(decrypt_lumina_secret(ciphertext, secret), plaintext)


if __name__ == "__main__":
    unittest.main()
