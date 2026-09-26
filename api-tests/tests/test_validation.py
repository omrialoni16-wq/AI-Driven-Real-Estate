"""Validation: bad input gets a 4xx with a useful message, never a 500 and never a silent success.

Known bugs are marked with `known_bug("Fn", ...)`: a strict xfail narrowed to
AssertionError (see LEARNING_NOTES.md, "A general rule for suppression
markers"). Each test asserts the CORRECT behaviour, so it fails today for the
documented reason, and fails loudly as XPASS the day the bug is fixed.
"""

import pytest

from assertions import assert_status
from data.factories import (
    MALFORMED_ID,
    NONEXISTENT_ID,
    OVERSIZED_STRING,
    property_payload,
    property_payload_without,
)
from findings import known_bug


# ─── Create: one invalid field at a time ─────────────────────────────────────
# Each payload is valid except for one field, so a 400 can only be about that field.


@pytest.mark.parametrize(
    "payload, bad_field",
    [
        pytest.param(property_payload_without("city"), "city", id="missing required field"),
        pytest.param(property_payload(price="abc"), "price", id="wrong type"),
        pytest.param(property_payload(rooms=-1), "rooms", id="below the schema minimum"),
        pytest.param(
            property_payload(price=-1_000_000), "price", id="negative price",
            marks=known_bug("F8", "no minimum on price; a negative price is saved (201)"),
        ),
        pytest.param(
            property_payload(type="Castle"), "type", id="unknown property type",
            marks=known_bug("F9", "type has no enum; any string is saved (201)"),
        ),
    ],
)
def test_creating_a_property_with_one_invalid_field_is_rejected_with_400_naming_that_field(
    admin_api, property_cleanup, payload, bad_field
):
    response = admin_api.create_property(payload)
    # Before any assertion: if a validation bug let this through, the property
    # still gets deleted after the test.
    property_cleanup.add_if_created(response)

    assert_status(response, 400)
    assert bad_field in response.json()["error"], f"error should name {bad_field!r}: {response.json()}"


def test_creating_a_property_with_an_oversized_body_is_rejected_with_413(admin_api, property_cleanup):
    response = admin_api.create_property(property_payload(street=OVERSIZED_STRING))
    property_cleanup.add_if_created(response)

    assert_status(response, 413)


@known_bug("F7", "body-parser errors fall through to Express's default HTML error page, with a stack trace")
def test_malformed_json_is_rejected_with_a_400_json_error(admin_api):
    response = admin_api.create_property_raw('{"city": "Haifa",')  # truncated JSON

    # Assert the status first: it's correct today, so the xfail below is about
    # the body format only.
    assert response.status_code == 400
    content_type = response.headers.get("Content-Type", "")
    assert content_type.startswith("application/json"), f"expected a JSON error body, got {content_type!r}"


@known_bug("F6", "the CORS origin check throws, and Express turns that into a 500 HTML page")
def test_request_from_a_disallowed_origin_is_not_a_server_error(api):
    response = api.list_properties_from_origin("https://evil.example", limit=1)

    # The right answer is a refusal the browser enforces (no
    # Access-Control-Allow-Origin header, or a 403), not a server error.
    assert response.status_code < 500, f"disallowed origin caused HTTP {response.status_code}"


# ─── Update ──────────────────────────────────────────────────────────────────


@known_bug("F2", "Mongoose ValidationError on update is caught as a 500")
def test_updating_a_property_with_an_invalid_value_is_rejected_with_400_and_not_saved(api, admin_api, created_property):
    response = admin_api.update_property(created_property["_id"], {"rooms": -1})

    # Checked first, and passing today: the invalid value is NOT saved
    # (runValidators works). Only the status code is wrong.
    [stored] = api.search_properties(city=created_property["city"]).json()["data"]
    assert stored["rooms"] == created_property["rooms"], "invalid update was saved"

    assert_status(response, 400)


# ─── Ids in the URL ──────────────────────────────────────────────────────────

ID_OPERATIONS = {
    "update": lambda api, admin_api, property_id: admin_api.update_property(property_id, {"rooms": 2}),
    "delete": lambda api, admin_api, property_id: admin_api.delete_property(property_id),
    "location": lambda api, admin_api, property_id: api.get_property_location(property_id),
}


# DELETE of a nonexistent id is covered by the CRUD delete test.
@pytest.mark.parametrize("operation", ["update", "location"])
def test_a_well_formed_id_that_does_not_exist_returns_404(api, admin_api, operation):
    response = ID_OPERATIONS[operation](api, admin_api, NONEXISTENT_ID)

    assert_status(response, 404)


# Three separate cases, because each controller has its own catch block: fixing
# one doesn't fix the others.
@known_bug("F1", "an id that isn't an ObjectId throws a CastError, caught as a 500")
@pytest.mark.parametrize("operation", ID_OPERATIONS)
def test_a_malformed_id_is_rejected_with_400(api, admin_api, operation):
    response = ID_OPERATIONS[operation](api, admin_api, MALFORMED_ID)

    assert_status(response, 400)


# ─── AI chat request body (rejected before any call to Groq) ─────────────────


def test_chat_without_a_message_is_rejected_with_400_before_calling_the_model(admin_api):
    response = admin_api.chat({"history": []})

    assert_status(response, 400)
    # This specific message comes from the early return in handleChat, before
    # the model is called. A model error would be a 500 with a different body.
    assert response.json()["error"] == "Missing 'message' in request body."


@known_bug("F5", "history is spread into an array unchecked; a non-array throws a TypeError, caught as a 500")
def test_chat_with_a_history_that_is_not_a_list_is_rejected_with_400(admin_api):
    # An object can't be spread into an array, so this fails before any call to
    # Groq, whether or not the bug is fixed.
    response = admin_api.chat({"message": "שלום", "history": {"role": "user"}})

    assert_status(response, 400)
