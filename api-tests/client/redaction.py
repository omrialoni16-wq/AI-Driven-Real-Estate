"""Keeps session secrets out of logs, assertion messages, and reports.

The session JWT authenticates as an admin for 3 hours. Anything that prints
text (the client's logs, assert_status's messages, the HTML report that
collects both) goes through these functions first.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from http.cookies import CookieError, SimpleCookie

REDACTED = "[REDACTED]"

# Headers that carry credentials in either direction.
SENSITIVE_HEADERS = frozenset({"cookie", "set-cookie", "authorization"})

# A JWT is three base64url segments separated by dots, and its header always
# starts with `eyJ` (base64 of `{"`). Matches any token in free text, e.g. an
# error body that echoes a token back.
JWT_PATTERN = re.compile(r"eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*")


def redact_headers(headers: Mapping[str, str]) -> dict[str, str]:
    """Copy of the headers with credential-carrying values replaced."""
    return {
        name: (REDACTED if name.lower() in SENSITIVE_HEADERS else value)
        for name, value in headers.items()
    }


def redact_text(text: str) -> str:
    """Replace anything that looks like a JWT in free text."""
    return JWT_PATTERN.sub(REDACTED, text)


def set_cookie_attributes(raw_set_cookie_headers: list[str], cookie_name: str) -> dict[str, str | bool] | None:
    """Attributes of one cookie from raw Set-Cookie headers, WITHOUT its value.

    Returns e.g. {"httponly": True, "samesite": "Lax", "path": "/", "max-age": "10800"},
    or None if the response didn't set that cookie.

    Tests assert on the result instead of on the raw header. If an assertion on
    the raw header failed, pytest would print the header, JWT included, into
    the failure report.
    """
    for header in raw_set_cookie_headers:
        cookie = SimpleCookie()
        try:
            cookie.load(header)
        except CookieError:
            continue
        if cookie_name in cookie:
            morsel = cookie[cookie_name]
            return {key: value for key, value in morsel.items() if value}
    return None
