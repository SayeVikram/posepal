"""
Pairing-code generation and hashing.

Security model
--------------
* Codes are 6-character strings drawn from [A-Z0-9] (36^6 ≈ 2.18 billion
  combinations), generated with `secrets.choice` (CSPRNG).
* The raw code is returned to the therapist exactly once and is NEVER
  persisted — only its HMAC-SHA256 digest is stored in the database.
* HMAC is keyed with PAIRING_CODE_SECRET, which prevents an attacker who
  obtains the hash column from brute-forcing codes offline (rainbow table
  resistance without the slow bcrypt round-trip that would prevent direct
  DB lookup).
* Submitted codes are normalised to uppercase before hashing so user input
  is case-insensitive.
"""

import hashlib
import hmac
import secrets
import string

from app.config import settings

_ALPHABET = string.ascii_uppercase + string.digits  # 36 chars


def generate_pairing_code() -> tuple[str, str]:
    """
    Return ``(raw_code, code_hash)``.

    ``raw_code``  — shown once to the therapist; never stored.
    ``code_hash`` — HMAC-SHA256 hex digest; written to ``pairing_codes.code_hash``.
    """
    raw = "".join(secrets.choice(_ALPHABET) for _ in range(6))
    return raw, _hmac_hex(raw)


def hash_submitted_code(raw_code: str) -> str:
    """
    Hash a code submitted by a patient so it can be looked up in the DB.
    Normalises to uppercase to make entry case-insensitive.
    """
    return _hmac_hex(raw_code.strip().upper())


def _hmac_hex(value: str) -> str:
    h = hmac.new(
        settings.PAIRING_CODE_SECRET.encode(),
        value.encode(),
        hashlib.sha256,
    )
    return h.hexdigest()
