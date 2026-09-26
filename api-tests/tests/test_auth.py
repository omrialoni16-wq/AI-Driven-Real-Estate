"""Authentication: login, session cookie, logout, token expiry, and admin registration.

Every login attempt goes through a fresh client from `make_client`, never the
shared `api` guest client. If a bug let a bad login succeed, the shared client
would pick up an admin cookie and every later "guest" test would quietly run
as an admin.
"""

import pytest

from assertions import assert_status
from client.redaction import JWT_PATTERN
from data.factories import admin_payload
from data.tokens import claims_of, sign_token
from findings import known_bug

# ─── Login ───────────────────────────────────────────────────────────────────


def test_login_with_valid_credentials_returns_the_user_and_sets_an_httponly_cookie(make_client, settings):
    client = make_client()
    response = client.login(settings.admin_email, settings.admin_password)

    assert_status(response, 200)
    body = response.json()
    assert body["user"]["email"] == settings.admin_email

    # The JWT must travel only in the httpOnly cookie, never in the body where
    # frontend JS (or an XSS payload) could read it. Checked as booleans, so a
    # failure message never prints the token itself.
    assert set(body) == {"user"}, f"login body should only contain 'user', got keys {sorted(body)}"
    body_contains_jwt = JWT_PATTERN.search(response.text) is not None
    assert not body_contains_jwt, "login response body contains a JWT"

    cookie = client.session_cookie_attributes(response)
    assert cookie is not None, "login did not set the session cookie"
    assert cookie.get("httponly") is True, f"session cookie must be HttpOnly, attributes: {cookie}"
    assert cookie.get("samesite", "").lower() == "lax", f"expected SameSite=Lax, attributes: {cookie}"


def test_session_cookie_from_login_grants_access_to_a_protected_endpoint(logged_in_client, settings):
    response = logged_in_client.me()

    assert_status(response, 200)
    assert response.json()["user"]["email"] == settings.admin_email


# Both cases must answer with the SAME status and message. If an unknown email
# got a different answer from a wrong password, an attacker could use login to
# find out which emails belong to admins.
@pytest.mark.parametrize(
    "email_kind",
    ["registered email, wrong password", "unregistered email"],
)
def test_login_with_bad_credentials_is_rejected_with_the_same_401(make_client, settings, email_kind):
    email = settings.admin_email if email_kind.startswith("registered") else "nobody@example.test"
    client = make_client()

    response = client.login(email, "definitely-not-the-password")

    assert_status(response, 401)
    assert response.json()["message"] == "Invalid email or password."
    assert not client.has_session_cookie(), "a failed login must not set a session cookie"


@pytest.mark.parametrize("missing_field", ["email", "password"])
def test_login_with_a_missing_field_is_rejected_with_400(make_client, settings, missing_field):
    credentials = {"email": settings.admin_email, "password": settings.admin_password}
    credentials[missing_field] = None  # the client leaves None fields out of the body

    response = make_client().login(**credentials)

    assert_status(response, 400)
    assert response.json()["message"]


def test_login_endpoint_is_rate_limited(make_client):
    # Can't cheaply trigger a 429 here: the test server raises the limit so the
    # suite can run repeatedly. Instead, check the limiter is in the request path:
    # it adds these headers to every response it counts.
    response = make_client().login("nobody@example.test", "wrong-password")

    for header in ("RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Policy"):
        assert header in response.headers, f"missing {header} header, got {sorted(response.headers)}"
    assert int(response.headers["RateLimit-Limit"]) > 0


# ─── Logout and token lifetime ───────────────────────────────────────────────


def test_logout_clears_the_cookie_and_ends_the_session_for_that_client(logged_in_client):
    response = logged_in_client.logout()

    assert_status(response, 200)
    assert not logged_in_client.has_session_cookie(), "logout should have removed the session cookie"
    assert_status(logged_in_client.me(), 401)


@known_bug("F13", "logout only clears the cookie; the JWT itself stays valid until it expires")
def test_token_captured_before_logout_is_rejected_after_logout(logged_in_client, make_client):
    replaying_client = make_client()
    # Passed straight across, never stored in a local, so it can't appear in a report.
    replaying_client.use_token(logged_in_client.session_token())

    assert_status(logged_in_client.logout(), 200)

    assert_status(replaying_client.me(), 401)


def test_expired_token_is_rejected_with_401(logged_in_client, make_client, settings):
    # Build two tokens with the admin's real claims, identical except for exp.
    # The first is a control: it must be accepted. That proves our signing
    # matches the server's, so if the second is rejected, the only possible
    # reason is that it's expired.
    claims = claims_of(logged_in_client.session_token())

    control = make_client()
    control.use_token(sign_token(claims, settings.jwt_secret, expires_in_seconds=3600))
    assert_status(control.me(), 200)

    expired = make_client()
    expired.use_token(sign_token(claims, settings.jwt_secret, expires_in_seconds=-60))
    response = expired.me()

    assert_status(response, 401)
    assert response.json()["message"] == "Invalid or expired session."


# ─── Register (negative paths only) ──────────────────────────────────────────
# A successful register creates an admin the API can't delete, so these tests
# only send requests the server must reject. They use the shared admin_api
# because register doesn't change the caller's session.


@pytest.mark.parametrize("missing_field", ["name", "email", "password"])
def test_register_with_a_missing_field_is_rejected_with_400(admin_api, missing_field):
    payload = admin_payload()
    del payload[missing_field]

    response = admin_api.register(payload)

    assert_status(response, 400)
    assert response.json()["message"]


def test_register_with_a_password_under_8_characters_is_rejected_with_400(admin_api):
    response = admin_api.register(admin_payload(password="short7!"))

    assert_status(response, 400)
    assert "8 characters" in response.json()["message"]


def test_register_with_an_existing_email_in_different_case_is_rejected_with_409(admin_api, settings):
    # Upper-casing checks that the server normalizes emails before comparing.
    # Otherwise "ADMIN@x" and "admin@x" would become two separate accounts.
    response = admin_api.register(admin_payload(email=settings.admin_email.upper()))

    assert_status(response, 409)
