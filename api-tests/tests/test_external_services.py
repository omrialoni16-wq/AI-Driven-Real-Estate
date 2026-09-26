"""Endpoints that call third-party services: the AI chat (Groq) and property location (Nominatim).

Marked `external`: slow, dependent on someone else's uptime, and (for Groq)
costing quota. Skip them in a fast run with:  pytest -m "not external"

These test the CONTRACT only: status code, response shape, and side effects.
Never the model's wording, which varies between calls by design. The request
validation for /api/chat (rejected before any external call) is tested in
test_validation.py and runs in every run.
"""

import pytest

from assertions import assert_status
from data.factories import property_payload

pytestmark = pytest.mark.external  # applies to every test in this file

# Rough bounding box around Israel. The backend always geocodes with country=Israel.
ISRAEL_LAT, ISRAEL_LNG = (29.0, 33.5), (34.0, 36.0)


def test_chat_answers_a_question_with_the_documented_response_shape(admin_api, property_cleanup):
    response = admin_api.chat({"message": "שלום, במה אתה יכול לעזור לי?", "history": []})

    # A question like this shouldn't make the agent add a property, but the
    # model decides, not us. If it did, clean that property up before asserting.
    if response.status_code == 200 and response.json().get("propertyId"):
        property_cleanup.add(response.json()["propertyId"])

    assert_status(response, 200)
    body = response.json()
    assert isinstance(body["reply"], str) and body["reply"].strip(), f"reply should be non-empty text: {body['reply']!r}"
    assert isinstance(body["actionPerformed"], bool)
    # The history goes back to the client for the next turn: the user's message,
    # then (at the end) the assistant's answer. Checked by role, not by wording.
    history = body["updatedHistory"]
    assert history[0] == {"role": "user", "content": "שלום, במה אתה יכול לעזור לי?"}
    assert history[-1]["role"] == "assistant"


def test_location_of_a_real_address_is_geocoded_and_saved_on_the_property(api, make_property):
    created = make_property(property_payload(city="תל אביב", street="דיזנגוף 50"))
    assert "lat" not in created, "a new property shouldn't have coordinates yet"

    response = api.get_property_location(created["_id"])

    assert_status(response, 200)
    coords = response.json()
    assert ISRAEL_LAT[0] < coords["lat"] < ISRAEL_LAT[1], f"lat outside Israel: {coords}"
    assert ISRAEL_LNG[0] < coords["lng"] < ISRAEL_LNG[1], f"lng outside Israel: {coords}"

    # The side effect: the endpoint writes the coordinates onto the property, so
    # later calls skip Nominatim. A GET that writes to the database is worth a
    # test of its own. (Calling /location twice wouldn't prove it: Nominatim
    # returns the same coordinates for the same address either way.)
    [stored] = [p for p in api.search_properties(city="תל אביב").json()["data"] if p["_id"] == created["_id"]]
    assert (stored["lat"], stored["lng"]) == (coords["lat"], coords["lng"])
