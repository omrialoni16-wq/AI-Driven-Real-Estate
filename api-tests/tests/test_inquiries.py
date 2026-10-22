"""Guest inquiries: a guest leaves a message on a property, an admin reads and triages it.

Every inquiry here belongs to a property from `created_property`. Deleting a
property deletes its inquiries too, so the property's cleanup also cleans up
the inquiries and no test needs a cleanup of its own.
"""

import pytest

from assertions import assert_status
from data.factories import MALFORMED_ID, NONEXISTENT_ID, inquiry_payload


def _admin_inquiries(admin_api, **params):
    """The newest inquiries, as the admin's inquiries list returns them."""
    response = admin_api.list_inquiries(limit=100, **params)
    assert_status(response, 200)
    return response.json()["inquiries"]


def _ids(inquiries):
    return [inquiry["_id"] for inquiry in inquiries]


@pytest.mark.parametrize(
    "contact",
    [{"email": None}, {"phone": None}],
    ids=["phone-only", "email-only"],
)
def test_guest_can_leave_an_inquiry_with_only_one_contact_detail(api, created_property, contact):
    payload = inquiry_payload(**contact)

    response = api.create_inquiry(created_property["_id"], payload)

    assert_status(response, 201)
    inquiry = response.json()["inquiry"]
    assert inquiry["property"] == created_property["_id"]
    assert inquiry["message"] == payload["message"]
    assert inquiry["status"] == "new"


def test_inquiry_without_phone_or_email_is_rejected(api, created_property):
    response = api.create_inquiry(created_property["_id"], inquiry_payload(phone=None, email=None))

    assert_status(response, 400)


def test_inquiry_without_a_message_is_rejected(api, created_property):
    response = api.create_inquiry(created_property["_id"], inquiry_payload(message=None))

    assert_status(response, 400)


def test_inquiry_with_an_invalid_email_is_rejected(api, created_property):
    response = api.create_inquiry(created_property["_id"], inquiry_payload(email="not-an-email"))

    assert_status(response, 400)


def test_inquiry_on_a_property_that_does_not_exist_returns_404(api):
    assert_status(api.create_inquiry(NONEXISTENT_ID, inquiry_payload()), 404)


def test_inquiry_on_a_malformed_property_id_returns_400(api):
    assert_status(api.create_inquiry(MALFORMED_ID, inquiry_payload()), 400)


def test_guest_cannot_set_the_status_of_their_own_inquiry(api, created_property):
    response = api.create_inquiry(created_property["_id"], inquiry_payload(status="closed"))

    assert_status(response, 201)
    assert response.json()["inquiry"]["status"] == "new"


def test_honeypot_submission_looks_successful_but_is_not_saved(api, admin_api, created_property):
    payload = inquiry_payload(website="http://spam.example.test")

    response = api.create_inquiry(created_property["_id"], payload)

    assert_status(response, 201)
    assert "inquiry" not in response.json()
    messages = [inquiry["message"] for inquiry in _admin_inquiries(admin_api)]
    assert payload["message"] not in messages


def test_guest_cannot_list_or_update_inquiries(api):
    assert_status(api.list_inquiries(), 401)
    assert_status(api.update_inquiry(NONEXISTENT_ID, {"status": "closed"}), 401)


def test_admin_sees_the_inquiry_with_its_property_details(api, admin_api, created_property):
    created = api.create_inquiry(created_property["_id"], inquiry_payload()).json()["inquiry"]

    [listed] = [inquiry for inquiry in _admin_inquiries(admin_api) if inquiry["_id"] == created["_id"]]

    assert listed["property"]["_id"] == created_property["_id"]
    assert listed["property"]["street"] == created_property["street"]
    assert listed["property"]["city"] == created_property["city"]


def test_admin_can_change_the_status_and_filter_by_it(api, admin_api, created_property):
    created = api.create_inquiry(created_property["_id"], inquiry_payload()).json()["inquiry"]

    response = admin_api.update_inquiry(created["_id"], {"status": "in_progress"})

    assert_status(response, 200)
    assert response.json()["inquiry"]["status"] == "in_progress"
    assert created["_id"] in _ids(_admin_inquiries(admin_api, status="in_progress"))
    assert created["_id"] not in _ids(_admin_inquiries(admin_api, status="new"))


def test_closing_an_inquiry_starts_its_retention_countdown_and_reopening_cancels_it(
    api, admin_api, created_property
):
    created = api.create_inquiry(created_property["_id"], inquiry_payload()).json()["inquiry"]
    assert "closedAt" not in created

    closed = admin_api.update_inquiry(created["_id"], {"status": "closed"})
    assert_status(closed, 200)
    assert closed.json()["inquiry"]["closedAt"], "closing did not set closedAt"

    reopened = admin_api.update_inquiry(created["_id"], {"status": "in_progress"})
    assert_status(reopened, 200)
    assert "closedAt" not in reopened.json()["inquiry"], "reopening did not clear closedAt"


def test_admin_cannot_set_an_unknown_status(api, admin_api, created_property):
    created = api.create_inquiry(created_property["_id"], inquiry_payload()).json()["inquiry"]

    assert_status(admin_api.update_inquiry(created["_id"], {"status": "archived"}), 400)


def test_deleting_a_property_deletes_its_inquiries(api, admin_api, created_property):
    created = api.create_inquiry(created_property["_id"], inquiry_payload()).json()["inquiry"]

    assert_status(admin_api.delete_property(created_property["_id"]), 200)

    assert created["_id"] not in _ids(_admin_inquiries(admin_api))
