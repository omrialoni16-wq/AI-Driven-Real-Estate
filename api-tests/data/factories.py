"""Builders for request payloads: a valid one, plus overrides to make it invalid in one specific way.

Every builder generates unique values (uuid4), so re-running the suite never
collides with data a previous run left behind.
"""

from __future__ import annotations

import uuid
from typing import Any


def unique_suffix() -> str:
    return uuid.uuid4().hex[:12]


def unique_city() -> str:
    """A city name no other property has, so a search by city finds exactly one test's data.

    Strictly alphanumeric on purpose: the backend passes the `city` filter
    straight into `new RegExp(city)` (FINDINGS F3). A regex metacharacter would
    change the search's meaning: "." matches any character, and "(" crashes the
    endpoint with a 500. Letters and hex digits are literal in a regex, so the
    filter behaves like the plain substring match the tests assume.
    """
    return f"Testcity{unique_suffix()}"


# Must be one of the type values the app uses (frontend/src/lib/propertyTypes.js).
APARTMENT = "דירה"


def property_payload(**overrides: Any) -> dict[str, Any]:
    """Body for POST /api/properties: every required field, valid, with a unique city."""
    payload = {
        "img": "https://example.test/images/property.jpg",
        "price": 2_500_000,
        "street": "Herzl 10",
        "city": unique_city(),
        "type": APARTMENT,
        "rooms": 4,
        "floor": 3,
        "size": 95,
        "tags": ["api-test"],
        "description": "Created by the API test suite.",
    }
    payload.update(overrides)
    return payload


def admin_payload(**overrides: Any) -> dict[str, Any]:
    """Body for POST /api/auth/register. Only used for requests that should be
    REJECTED: a successful register creates a user the API can't delete."""
    payload = {
        "name": "Register Test",
        "email": f"register-{unique_suffix()}@example.test",
        "password": "long-enough-password",
    }
    payload.update(overrides)
    return payload


def property_payload_without(field: str) -> dict[str, Any]:
    """A valid property payload with one field removed."""
    payload = property_payload()
    del payload[field]
    return payload


# Longer than the backend's whole JSON body limit (express.json({ limit: "10kb" })),
# so a payload carrying it is rejected before any validation runs.
OVERSIZED_STRING = "x" * 20_000


# Ids for negative-path tests. Both are fake on purpose:
# NONEXISTENT_ID is a well-formed ObjectId (24 hex chars) that no document has,
# so the server can parse it and must answer 404. MALFORMED_ID isn't an ObjectId
# at all, so the server must reject it as bad input (FINDINGS F1).
NONEXISTENT_ID = "000000000000000000000000"
MALFORMED_ID = "not-an-id"
