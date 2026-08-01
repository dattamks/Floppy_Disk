"""Storage backend resolution + secret encryption for the owner-configured store.

Backend precedence (mirrors how the DB is chosen), highest first:

1. **Environment** - if R2 env vars are set (``settings.R2_CONFIGURED``), the
   operator's config wins and the UI shows it read-only.
2. **Database** - the ``StorageConfig`` row the owner saved in the UI.
3. **Local disk** - the default when neither is configured.

The R2 secret access key is encrypted at rest with Fernet, using a key derived
from ``settings.SECRET_KEY`` (which is itself persisted per-instance), and is
never returned to any client.
"""
from __future__ import annotations

import base64
import hashlib

from django.conf import settings


def _fernet():
    from cryptography.fernet import Fernet

    # Derive a stable 32-byte urlsafe key from the instance SECRET_KEY.
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    if not token:
        return ""
    return _fernet().decrypt(token.encode("ascii")).decode("utf-8")


def env_manages_storage() -> bool:
    """True when R2 is configured via environment variables (operator path)."""
    return bool(getattr(settings, "R2_CONFIGURED", False))


def effective_backend() -> str:
    """The backend actually in force right now: 'r2' or 'local'."""
    if env_manages_storage():
        return "r2"
    from .models import StorageConfig

    cfg = StorageConfig.load()
    if cfg.backend == StorageConfig.Backend.R2 and cfg.r2_is_complete():
        return "r2"
    return "local"
