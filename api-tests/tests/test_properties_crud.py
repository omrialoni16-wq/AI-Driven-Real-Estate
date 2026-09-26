"""Create, read back, update, delete: the admin's core workflow.

Each test gets its own freshly created property (via `created_property` or
`make_property`) and never relies on another test's data. There is no
GET /api/properties/:id endpoint, so "read back" means searching by the
property's unique city.
"""

from assertions import assert_status
from data.factories import property_payload

# Fields the server should store exactly as sent.
STORED_AS_SENT = ("img", "price", "street", "city", "type", "rooms", "floor", "size", "tags", "description")


def _find_by_city(api, city):
    """All properties whose city matches `city`, via the public search endpoint."""
    response = api.search_properties(city=city)
    assert_status(response, 200)
    return response.json()["data"]


def test_creating_a_property_returns_201_with_an_id_and_every_field_as_sent(make_property):
    payload = property_payload()

    created = make_property(payload)  # asserts 201 itself

    assert created["_id"], "created property has no _id"
    assert created["createdAt"], "created property has no createdAt timestamp"
    # Comparing two dicts: on failure pytest prints exactly which fields differ.
    assert {field: created[field] for field in STORED_AS_SENT} == {field: payload[field] for field in STORED_AS_SENT}


def test_created_property_can_be_found_by_searching_for_its_city(api, created_property):
    # Searched as a guest: a created listing must be publicly visible.
    matches = _find_by_city(api, created_property["city"])

    assert [match["_id"] for match in matches] == [created_property["_id"]], (
        f"expected exactly the created property for city {created_property['city']!r}, got {matches}"
    )
    assert matches[0]["price"] == created_property["price"]


def test_updating_a_property_changes_only_the_sent_fields_and_the_change_persists(api, admin_api, created_property):
    changes = {"price": created_property["price"] + 100_000, "rooms": created_property["rooms"] + 1}

    response = admin_api.update_property(created_property["_id"], changes)

    assert_status(response, 200)
    updated = response.json()
    assert {field: updated[field] for field in changes} == changes
    unchanged = [field for field in STORED_AS_SENT if field not in changes]
    assert {field: updated[field] for field in unchanged} == {field: created_property[field] for field in unchanged}

    # The response could come from memory; the read-back proves the change is in the database.
    [stored] = _find_by_city(api, created_property["city"])
    assert {field: stored[field] for field in changes} == changes


def test_deleting_a_property_removes_it_and_a_second_delete_returns_404(api, admin_api, created_property):
    response = admin_api.delete_property(created_property["_id"])

    assert_status(response, 200)
    assert response.json()["deletedProperty"]["_id"] == created_property["_id"]
    assert _find_by_city(api, created_property["city"]) == [], "deleted property still shows up in search"

    assert_status(admin_api.delete_property(created_property["_id"]), 404)
