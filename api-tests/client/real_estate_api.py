"""One method per endpoint of the Real Estate API.

This is the only file that knows endpoint paths. If the backend renames a
route, this file changes and no test does.

Every method returns the raw requests.Response, so tests can assert on the
status code first and then on the body.
"""

from __future__ import annotations

from typing import Any

import requests

from client.base_client import BaseClient
from client.redaction import set_cookie_attributes

API = "/api"

# Name of the httpOnly cookie the backend stores the JWT in (authController.js).
SESSION_COOKIE = "token"


class RealEstateApi(BaseClient):
    # ─── Session cookie ──────────────────────────────────────────────────────
    # Tests go through these helpers instead of touching session.cookies
    # directly. The reason is leaks: if a test asserted on the cookie jar and
    # failed, pytest would print the jar's repr, JWT included, into the report.

    def has_session_cookie(self) -> bool:
        return SESSION_COOKIE in self.session.cookies

    def session_token(self) -> str | None:
        """The raw JWT this client holds. Pass it to another client; never assert on or print it."""
        return self.session.cookies.get(SESSION_COOKIE)

    def use_token(self, token: str) -> None:
        """Send `token` as the session cookie from now on, e.g. a forged or expired token."""
        self.session.cookies.set(SESSION_COOKIE, token)

    @staticmethod
    def session_cookie_attributes(response: requests.Response) -> dict[str, str | bool] | None:
        """Attributes (HttpOnly, SameSite, Max-Age, ...) of the session cookie set by
        `response`, without its value. None if the response didn't set it."""
        return set_cookie_attributes(response.raw.headers.getlist("Set-Cookie"), SESSION_COOKIE)

    # ─── Auth ────────────────────────────────────────────────────────────────

    def login(self, email: str | None, password: str | None) -> requests.Response:
        """POST /api/auth/login. A field passed as None is left out of the body,
        which is how tests send a request with a missing field."""
        body = {key: value for key, value in (("email", email), ("password", password)) if value is not None}
        return self.post(f"{API}/auth/login", json=body)

    def logout(self) -> requests.Response:
        return self.post(f"{API}/auth/logout")

    def me(self) -> requests.Response:
        return self.get(f"{API}/auth/me")

    def register(self, payload: dict[str, Any]) -> requests.Response:
        return self.post(f"{API}/auth/register", json=payload)

    # ─── Properties ──────────────────────────────────────────────────────────

    def list_properties(self, **params: Any) -> requests.Response:
        """GET /api/properties. params: page, limit, city, maxPrice, type."""
        return self.get(f"{API}/properties", params=params)

    def search_properties(self, **params: Any) -> requests.Response:
        """GET /api/search. params: city, type, minPrice, maxPrice, rooms, floor,
        minSize, maxSize, tags. A list value (tags=["a", "b"]) is sent as a
        repeated key: ?tags=a&tags=b."""
        return self.get(f"{API}/search", params=params)

    def list_properties_from_origin(self, origin: str, **params: Any) -> requests.Response:
        """GET /api/properties as a browser on `origin` would send it (with an Origin header), for CORS tests."""
        return self.get(f"{API}/properties", params=params, headers={"Origin": origin})

    def create_property(self, payload: dict[str, Any]) -> requests.Response:
        return self.post(f"{API}/properties", json=payload)

    def create_property_raw(self, body: str) -> requests.Response:
        """POST /api/properties with `body` sent as-is, labelled as JSON, for malformed-JSON tests."""
        return self.post(f"{API}/properties", data=body.encode(), headers={"Content-Type": "application/json"})

    def update_property(self, property_id: str, payload: dict[str, Any]) -> requests.Response:
        return self.put(f"{API}/properties/{property_id}", json=payload)

    def delete_property(self, property_id: str) -> requests.Response:
        return self.delete(f"{API}/properties/{property_id}")

    def get_property_location(self, property_id: str) -> requests.Response:
        """GET /api/properties/:id/location. Calls Nominatim and writes lat/lng to the DB."""
        return self.get(f"{API}/properties/{property_id}/location")

    # ─── AI chat ─────────────────────────────────────────────────────────────

    def chat(self, payload: dict[str, Any]) -> requests.Response:
        """POST /api/chat with {message, history}. Calls Groq unless the body is rejected first."""
        return self.post(f"{API}/chat", json=payload)
