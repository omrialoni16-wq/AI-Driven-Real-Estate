"""A thin wrapper over requests.Session: URL joining, a default timeout, and logging.

Knows nothing about this particular API. Endpoint paths live in real_estate_api.py.
"""

from __future__ import annotations

import logging

import requests

from client.redaction import redact_headers, redact_text

log = logging.getLogger("api")


class BaseClient:
    def __init__(self, base_url: str, timeout: float) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        # A Session keeps cookies between requests, like a browser tab does.
        # After a successful login it holds the httpOnly `token` cookie and sends
        # it automatically on every later request.
        self.session = requests.Session()

    def request(self, method: str, path: str, **kwargs) -> requests.Response:
        """Send one request and return the raw Response, whatever its status code.

        No raise_for_status(): a 401 or 404 is often exactly what a test expects,
        so deciding what counts as "wrong" is the test's job, not the client's.
        """
        url = f"{self.base_url}/{path.lstrip('/')}"
        # Without a timeout, requests waits forever on a hung server and the
        # whole suite freezes instead of failing.
        kwargs.setdefault("timeout", self.timeout)
        response = self.session.request(method, url, **kwargs)

        # pytest captures these records and prints them under a failing test
        # ("Captured log call"), so every failure shows the HTTP traffic that led to it.
        # Never logged in the clear: request bodies (the login body contains a
        # password), and the Cookie / Set-Cookie / Authorization headers (they
        # carry the session JWT). See client/redaction.py.
        log.info(
            "%s %s -> %s (%.0f ms)",
            method,
            response.url,
            response.status_code,
            response.elapsed.total_seconds() * 1000,
        )
        log.debug("Request headers: %s", redact_headers(response.request.headers))
        log.debug("Response headers: %s", redact_headers(response.headers))
        log.debug("Response body: %.500s", redact_text(response.text))
        return response

    def get(self, path: str, **kwargs) -> requests.Response:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs) -> requests.Response:
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs) -> requests.Response:
        return self.request("PUT", path, **kwargs)

    def delete(self, path: str, **kwargs) -> requests.Response:
        return self.request("DELETE", path, **kwargs)

    def close(self) -> None:
        self.session.close()
