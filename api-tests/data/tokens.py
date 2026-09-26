"""Builders for JWTs, to test how the server treats tokens it didn't just issue.

Signing uses the TEST server's secret (TEST_JWT_SECRET), so these tokens
only work against the test server.
"""

from __future__ import annotations

import base64
import json
import time
from typing import Any

import jwt

# Mirrors the backend: HS256, 3-hour lifetime (authController.js).
ALGORITHM = "HS256"
TOKEN_LIFETIME_SECONDS = 3 * 60 * 60


def claims_of(token: str) -> dict[str, Any]:
    """Read a token's payload without verifying it (userId, name, email, iat, exp)."""
    return jwt.decode(token, options={"verify_signature": False})


def sign_token(claims: dict[str, Any], secret: str, *, expires_in_seconds: int) -> str:
    """Sign `claims` with a fresh exp. A negative expires_in_seconds gives an already-expired token.

    iat is set to exp minus the real lifetime, so an expired token looks like a
    genuine one that simply ran out, not an impossible "expired before it was issued" token.
    """
    expires_at = int(time.time()) + expires_in_seconds
    payload = {
        **{key: value for key, value in claims.items() if key not in ("iat", "exp")},
        "iat": expires_at - TOKEN_LIFETIME_SECONDS,
        "exp": expires_at,
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


# ─── Tokens the server must reject ───────────────────────────────────────────
# Each one below keeps the real admin's claims and breaks exactly one thing,
# so if the server accepted it, the claims would log it in as that admin.


def _b64url(data: dict[str, Any]) -> str:
    """Base64url-encode a JSON object without padding, the way JWT segments are encoded."""
    raw = json.dumps(data, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def tampered(token: str, **claim_changes: Any) -> str:
    """The same token with its payload edited and its original signature kept.

    The signature was computed over the old payload, so it no longer matches.
    This is what an attacker gets by editing a real token in a JWT debugger.
    """
    header, _payload, signature = token.split(".")
    return f"{header}.{_b64url({**claims_of(token), **claim_changes})}.{signature}"


def unsigned(claims: dict[str, Any]) -> str:
    """A token that declares `"alg": "none"` and has an empty signature.

    A classic JWT attack: a verifier that trusts the token's own header would
    accept it without checking any signature. The backend pins HS256.
    """
    return f"{_b64url({'alg': 'none', 'typ': 'JWT'})}.{_b64url(claims)}."
