"""Filtering, search and pagination: filters narrow results correctly, and pages split them correctly.

Every test builds its own small listing in a unique city and filters inside
that city. The expected results are then known exactly, no matter what else
is in the database.
"""

import pytest

from assertions import assert_status
from data.factories import property_payload, unique_city
from findings import known_bug



DUPLEX = "דופלקס"


@pytest.fixture
def listing(make_property):
    """Three properties in one unique city, chosen so each filter below picks a known subset.

             price       type      rooms  size  tags
      cheap  1,000,000   apartment   3     70   api-test, balcony
      mid    2,000,000   apartment   4     95   api-test
      dear   3,000,000   duplex      5    140   api-test
    """
    city = unique_city()
    rows = {
        "cheap": property_payload(city=city, price=1_000_000, rooms=3, size=70, tags=["api-test", "balcony"]),
        "mid": property_payload(city=city, price=2_000_000, rooms=4, size=95),
        "dear": property_payload(city=city, price=3_000_000, rooms=5, size=140, type=DUPLEX),
    }
    ids = {name: make_property(payload)["_id"] for name, payload in rows.items()}
    return {"city": city, "ids": ids}


def names_in(listing, properties):
    """Translate returned properties back to the fixture's row names, for readable assertions."""
    by_id = {pid: name for name, pid in listing["ids"].items()}
    return {by_id.get(prop["_id"], f"UNEXPECTED {prop['_id']}") for prop in properties}


# ─── GET /api/properties filters ─────────────────────────────────────────────


def test_max_price_filter_keeps_properties_at_or_below_the_price(api, listing):
    # 2,000,000 is exactly "mid"'s price: checks the bound is inclusive.
    response = api.list_properties(city=listing["city"], maxPrice=2_000_000)

    assert_status(response, 200)
    assert names_in(listing, response.json()["properties"]) == {"cheap", "mid"}


def test_type_filter_keeps_only_that_property_type(api, listing):
    response = api.list_properties(city=listing["city"], type=DUPLEX)

    assert_status(response, 200)
    assert names_in(listing, response.json()["properties"]) == {"dear"}


# ─── GET /api/search ─────────────────────────────────────────────────────────


def test_search_combines_a_price_range_with_a_room_count(api, listing):
    response = api.search_properties(city=listing["city"], minPrice=1_500_000, maxPrice=3_500_000, rooms=4)

    assert_status(response, 200)
    assert names_in(listing, response.json()["data"]) == {"mid"}


# A minimal pair: the same tag filter sent two ways. Only the transport differs.
@pytest.mark.parametrize(
    "tags",
    [
        pytest.param(["balcony", "api-test"], id="two tags (repeated query key)"),
        pytest.param(
            ["balcony"], id="one tag (single query key)",
            marks=known_bug("F11", "a single ?tags=x arrives as a string, fails Array.isArray, and is ignored"),
        ),
    ],
)
def test_search_by_tags_keeps_only_properties_that_have_every_tag(api, listing, tags):
    response = api.search_properties(city=listing["city"], tags=tags)

    assert_status(response, 200)
    assert names_in(listing, response.json()["data"]) == {"cheap"}


# ─── Pagination ──────────────────────────────────────────────────────────────


def test_pagination_splits_results_into_pages_of_the_requested_size(api, listing):
    first = api.list_properties(city=listing["city"], limit=2, page=1)
    second = api.list_properties(city=listing["city"], limit=2, page=2)

    assert_status(first, 200)
    assert_status(second, 200)
    first_body, second_body = first.json(), second.json()
    assert (first_body["totalProperties"], first_body["totalPages"]) == (3, 2)
    assert [len(first_body["properties"]), len(second_body["properties"])] == [2, 1]
    # Together the pages hold every property exactly once: no gaps, no repeats.
    first_page, second_page = names_in(listing, first_body["properties"]), names_in(listing, second_body["properties"])
    assert first_page.isdisjoint(second_page), f"a property appears on both pages: {first_page & second_page}"
    assert first_page | second_page == {"cheap", "mid", "dear"}


def test_a_page_past_the_end_returns_200_with_no_properties(api, listing):
    response = api.list_properties(city=listing["city"], limit=2, page=99)

    assert_status(response, 200)
    body = response.json()
    assert body["properties"] == []
    assert (body["currentPage"], body["totalProperties"]) == (99, 3)


# ─── User input reaching a regex / a number cast (FINDINGS F3, F4) ───────────
# The city filter is built with `new RegExp(city)`, so the user's text is
# interpreted as a regular expression, not as plain text.


@known_bug("F3", "an unbalanced '(' is an invalid regex; new RegExp throws and the endpoint returns 500")
@pytest.mark.parametrize("endpoint", ["list_properties", "search_properties"])
def test_city_filter_with_an_unbalanced_parenthesis_is_not_a_server_error(api, endpoint):
    # Both endpoints build the regex in separate service functions, so each needs its own fix.
    response = getattr(api, endpoint)(city="(")

    assert response.status_code < 500, f"city='(' caused HTTP {response.status_code}: {response.text[:200]}"


@known_bug("F3", "'.' is a regex wildcard, so city='.' matches every city instead of none")
def test_city_filter_with_a_dot_matches_only_cities_containing_a_literal_dot(api, created_property):
    # created_property's city is alphanumeric: no literal "." in it. A plain-text
    # filter for "." must not return it; a regex "." matches any character.
    response = api.search_properties(city=".")

    assert_status(response, 200)
    returned_ids = {prop["_id"] for prop in response.json()["data"]}
    assert created_property["_id"] not in returned_ids, "city='.' matched a city that contains no '.'"


@known_bug("F4", "Number('abc') is NaN; the NaN reaches the Mongo query and the cast error is a 500")
def test_search_with_a_non_numeric_min_price_is_rejected_with_400(api):
    response = api.search_properties(minPrice="abc")

    assert_status(response, 400)
