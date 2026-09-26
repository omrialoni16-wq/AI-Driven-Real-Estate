"""Authorization: every admin-only endpoint refuses anyone without a valid session.

Why this isn't a full endpoints x credentials cross-product
-----------------------------------------------------------
Every protected route uses the same `requireAuth` middleware (checked in
PropertyRoutes.js and authRoutes.js). That leaves two independent questions:

  1. Is the middleware attached to each protected route?   -> one test per endpoint
  2. Does the middleware reject each kind of bad token?     -> one test per token kind

A full cross-product (6 endpoints x 4 token kinds = 24 cases) would run the
same middleware code 24 times to answer those two questions. It would only
start earning its cost if an endpoint had its own auth logic.

Every request here is harmless even if authorization is broken: an empty body
or a nonexistent id. A missing auth check makes these tests fail; it never
lets them create, change, or delete real data.
"""

from collections.abc import Callable
from typing import NamedTuple

import pytest
from requests import Response

from assertions import assert_status
from client.real_estate_api import RealEstateApi
from data.factories import NONEXISTENT_ID
from data.tokens import claims_of, sign_token, tampered, unsigned


class ProtectedCall(NamedTuple):
    send: Callable[[RealEstateApi], Response]
    # What the same harmless request gets WITH a valid session: the control.
    status_with_session: int


PROTECTED_CALLS = {
    "POST /api/properties": ProtectedCall(lambda c: c.create_property({}), 400),
    "PUT /api/properties/:id": ProtectedCall(lambda c: c.update_property(NONEXISTENT_ID, {}), 404),
    "DELETE /api/properties/:id": ProtectedCall(lambda c: c.delete_property(NONEXISTENT_ID), 404),
    # An empty body is rejected before any call to Groq.
    "POST /api/chat": ProtectedCall(lambda c: c.chat({}), 400),
    "POST /api/auth/register": ProtectedCall(lambda c: c.register({}), 400),
    "GET /api/auth/me": ProtectedCall(lambda c: c.me(), 200),
}


@pytest.mark.parametrize("endpoint", PROTECTED_CALLS)
def test_protected_endpoint_answers_401_to_a_guest_but_not_to_an_admin(api, admin_api, endpoint):
    call = PROTECTED_CALLS[endpoint]

    # Control first: with a session, the request gets past authentication. That
    # proves the guest's 401 below comes from the missing session, not from a
    # wrong path or a broken request.
    assert_status(call.send(admin_api), call.status_with_session)

    response = call.send(api)

    assert_status(response, 401)
    assert response.json()["message"] == "Authentication required."


# Each builder takes the admin's real token and breaks exactly one thing about
# it. The claims still say "I am the test admin", so if the server accepted any
# of them, /me would answer 200 with the admin's details.
BAD_TOKENS: dict[str, Callable[[str], str]] = {
    "malformed (not a JWT)": lambda token: "not-a-jwt",
    "payload tampered, original signature": lambda token: tampered(token, name="Mallory"),
    "signed with the wrong secret": lambda token: sign_token(
        claims_of(token), "an-attacker-guess-at-the-secret-" + "x" * 16, expires_in_seconds=3600
    ),
    'unsigned, header says "alg": "none"': lambda token: unsigned(claims_of(token)),
}


@pytest.mark.parametrize("token_kind", BAD_TOKENS)
def test_session_cookie_with_an_invalid_token_is_rejected_with_401(admin_api, make_client, token_kind):
    client = make_client()
    # Built from the admin's token and passed straight in, never stored, so it
    # can't end up in a report.
    client.use_token(BAD_TOKENS[token_kind](admin_api.session_token()))

    response = client.me()

    assert_status(response, 401)
    assert response.json()["message"] == "Invalid or expired session."
