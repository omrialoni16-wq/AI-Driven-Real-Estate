"""The read-only demo admin: portfolio visitors see the whole admin side, but change nothing.

The demo session comes from POST /api/auth/demo, with no user in the auth
database. Every write it attempts must answer 403 DEMO_READ_ONLY and leave the
data as it was, and the inquiries list must never show real guests' details.

The write tests aim at REAL data (a property and an inquiry the test created),
so a broken guard fails the test instead of hitting a nonexistent id and
answering 404 for the wrong reason.
"""

import pytest

from assertions import assert_status
from data.factories import NONEXISTENT_ID, admin_payload, inquiry_payload, property_payload

DEMO_INQUIRY_ID_PREFIX = "demo-inquiry-"


@pytest.fixture
def demo_api(make_client):
    """A fresh client logged in as the demo admin."""
    client = make_client()
    assert_status(client.demo_login(), 200)
    return client


def _assert_demo_read_only(response):
    __tracebackhide__ = True
    assert_status(response, 403)
    assert response.json()["code"] == "DEMO_READ_ONLY"


def test_demo_login_starts_a_demo_session_without_credentials(make_client):
    client = make_client()

    response = client.demo_login()

    assert_status(response, 200)
    assert response.json()["user"]["isDemo"] is True
    assert client.has_session_cookie()

    me = client.me()
    assert_status(me, 200)
    assert me.json()["user"]["isDemo"] is True


def test_a_real_admin_is_not_a_demo_user(admin_api):
    response = admin_api.me()

    assert_status(response, 200)
    assert response.json()["user"]["isDemo"] is False


def test_demo_admin_cannot_create_a_property(demo_api, property_cleanup):
    response = demo_api.create_property(property_payload())
    property_cleanup.add_if_created(response)

    _assert_demo_read_only(response)


def test_demo_admin_cannot_edit_a_property(demo_api, api, created_property):
    response = demo_api.update_property(created_property["_id"], {"price": 1})

    _assert_demo_read_only(response)
    found = api.search_properties(city=created_property["city"]).json()["data"]
    assert [prop["price"] for prop in found] == [created_property["price"]]


def test_demo_admin_cannot_delete_a_property(demo_api, api, created_property):
    response = demo_api.delete_property(created_property["_id"])

    _assert_demo_read_only(response)
    found = api.search_properties(city=created_property["city"]).json()["data"]
    assert [prop["_id"] for prop in found] == [created_property["_id"]]


def test_demo_admin_cannot_change_an_inquiry_status(demo_api, api, admin_api, created_property):
    created = api.create_inquiry(created_property["_id"], inquiry_payload())
    assert_status(created, 201)
    inquiry_id = created.json()["inquiry"]["_id"]

    response = demo_api.update_inquiry(inquiry_id, {"status": "closed"})

    _assert_demo_read_only(response)
    listed = admin_api.list_inquiries(limit=100).json()["inquiries"]
    assert next(i["status"] for i in listed if i["_id"] == inquiry_id) == "new"


def test_demo_admin_cannot_create_another_admin(demo_api):
    _assert_demo_read_only(demo_api.register(admin_payload()))


def test_demo_admin_sees_only_made_up_inquiries(demo_api, api, created_property):
    # A real inquiry exists; the demo admin must not see it.
    assert_status(api.create_inquiry(created_property["_id"], inquiry_payload()), 201)

    response = demo_api.list_inquiries(limit=100)

    assert_status(response, 200)
    inquiries = response.json()["inquiries"]
    assert inquiries, "the demo should show sample inquiries"
    assert all(i["_id"].startswith(DEMO_INQUIRY_ID_PREFIX) for i in inquiries)


def test_demo_inquiries_can_be_filtered_by_status(demo_api):
    response = demo_api.list_inquiries(status="closed")

    assert_status(response, 200)
    body = response.json()
    assert body["totalInquiries"] == len(body["inquiries"]) > 0
    assert {i["status"] for i in body["inquiries"]} == {"closed"}


def test_demo_chat_without_a_message_is_rejected_before_using_up_the_demo(demo_api):
    # Validation comes first, so a bad request doesn't spend the one message.
    assert_status(demo_api.chat({}), 400)
    assert_status(demo_api.chat({}), 400)


@pytest.mark.external
def test_demo_chat_allows_exactly_one_message(demo_api):
    first = demo_api.chat({"message": "מה המחיר הממוצע בתל אביב?"})
    assert_status(first, 200)

    second = demo_api.chat({"message": "ועוד שאלה"})

    assert_status(second, 403)
    assert second.json()["code"] == "DEMO_CHAT_USED"


@pytest.mark.external
def test_demo_chat_cannot_add_a_property(demo_api, api):
    city = f"דמו-{NONEXISTENT_ID[-6:]}"
    message = (
        f"תוסיף נכס: עיר {city}, רחוב הרצל, מחיר 1500000, 3 חדרים, 80 מ\"ר, קומה 2, סוג דירה"
    )

    response = demo_api.chat({"message": message})

    assert_status(response, 200)
    assert response.json()["actionPerformed"] is False
    assert api.search_properties(city=city).json()["data"] == []
