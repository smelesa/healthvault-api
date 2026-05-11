"""Fernet encryption for file storage."""
from cryptography.fernet import Fernet
import base64


class FernetEncryption:
    def __init__(self, key: str):
        if not key:
            raise ValueError("ENCRYPTION_KEY must be set")
        # Handle raw base64 key
        try:
            self._fernet = Fernet(key.encode() if isinstance(key, str) else key)
        except Exception:
            # If key is not valid Fernet key, try hashing it
            import hashlib, os
            key_bytes = hashlib.sha256(key.encode()).digest()
            fernet_key = base64.urlsafe_b64encode(key_bytes)
            self._fernet = Fernet(fernet_key)

    def encrypt(self, data: bytes) -> bytes:
        return self._fernet.encrypt(data)

    def decrypt(self, data: bytes) -> bytes:
        return self._fernet.decrypt(data)