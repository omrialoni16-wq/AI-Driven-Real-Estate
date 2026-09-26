"""Assertion helpers that make failures readable without re-reading the test."""

from __future__ import annotations

import requests

from client.redaction import redact_text

BODY_PREVIEW_CHARS = 500


def assert_status(response: requests.Response, expected: int) -> None:
    """Assert the status code; on failure, show the request and the body that came back.

    A bare `assert response.status_code == 200` fails with `assert 500 == 200`,
    which says nothing about which call failed or why. This says both.
    """
    # Tells pytest to leave this helper out of the traceback, so the failure
    # points at the line in the test that called it.
    __tracebackhide__ = True
    if response.status_code != expected:
        request = response.request
        raise AssertionError(
            f"Expected {expected} from {request.method} {request.url}, "
            f"got {response.status_code}.\n"
            f"Response body: {redact_text(response.text)[:BODY_PREVIEW_CHARS]}"
        )
