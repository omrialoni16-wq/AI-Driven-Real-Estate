"""Smoke tests: is the API up and answering in the shape we expect?

If these fail, nothing else in the suite is worth reading yet.
"""

from assertions import assert_status


def test_public_listing_endpoint_answers_with_paginated_shape(api):
    # limit=1 keeps the response tiny; this checks the server and the DB are up,
    # not the listing logic itself (that lives in test_search_and_filtering.py).
    response = api.list_properties(limit=1)

    assert_status(response, 200)
    body = response.json()
    assert body["success"] is True
    assert isinstance(body["properties"], list), f"'properties' should be a list, got {body['properties']!r}"
    assert body["currentPage"] == 1
    for key in ("totalProperties", "totalPages"):
        assert isinstance(body[key], int), f"{key!r} should be an int, got {body[key]!r}"


def test_protected_endpoint_answers_401_json_for_a_guest(api):
    # Doesn't touch the database, so if this passes and the test above fails,
    # the problem is the DB connection, not the server.
    response = api.me()

    assert_status(response, 401)
    assert response.headers["Content-Type"].startswith("application/json")
    assert response.json()["message"], "401 body should carry a non-empty 'message'"
