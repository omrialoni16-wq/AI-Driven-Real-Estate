"""Shared fixtures. pytest loads this file automatically before collecting any test."""

from collections.abc import Callable, Iterator

import pytest
import requests

from assertions import assert_status
from client.real_estate_api import RealEstateApi
from config import ConfigError, Settings, load_settings
from data.factories import property_payload

# Timeout for the one-off "is the server up?" probe. Short on purpose: if
# nothing answers within a few seconds, nothing will.
REACHABILITY_TIMEOUT_SECONDS = 3


# ─── HTML report ─────────────────────────────────────────────────────────────
# pytest-html calls these hooks while building reports/report.html.


def pytest_html_report_title(report) -> None:
    report.title = "Real Estate API: test report"


def pytest_metadata(metadata: dict) -> None:
    """Add the tested environment to the report's header. Non-secret values only:
    the URL and database NAMES, never the connection strings or credentials."""
    try:
        settings = load_settings()
    except ConfigError:
        return  # the settings fixture stops the run with the real error
    metadata["API base URL"] = settings.base_url
    metadata["Properties database"] = settings.properties_db_name
    metadata["Auth database"] = settings.auth_db_name


# autouse=True: every test depends on this fixture without asking for it, so the
# safety check always runs first. scope="session": it runs once per run, not once
# per test.
#
# pytest.exit (not pytest.fail): a bad config is not one test failing. It means
# nothing can run safely, so stop the whole session with a single clear message
# instead of reporting the same error for every test.
#
# Caveat: pytest only sets up fixtures for tests it actually runs. With zero
# tests collected, this guard never runs. Use `python config.py` to check the config on its own.
@pytest.fixture(scope="session", autouse=True)
def settings() -> Settings:
    """Validated settings; stops the run if the target isn't a local server with *_test databases."""
    try:
        return load_settings()
    except ConfigError as error:
        pytest.exit(f"Configuration error: {error}", returncode=pytest.ExitCode.USAGE_ERROR)


@pytest.fixture(scope="session", autouse=True)
def require_server_reachable(settings: Settings) -> None:
    """Stop the run with one clear message if nothing answers at API_BASE_URL.

    Without this, a stopped server produces one ConnectionError traceback per
    test: dozens of identical failures that bury the actual problem.
    """
    probe = RealEstateApi(settings.base_url, REACHABILITY_TIMEOUT_SECONDS)
    try:
        # /api/auth/me answers 401 without touching the database, so this checks
        # only "is the server up", not "is the DB up".
        probe.me()
    except requests.exceptions.RequestException as error:
        pytest.exit(
            f"API not reachable at {settings.base_url} ({type(error).__name__}).\n"
            f"Start the test server in another terminal:  python scripts/run_test_server.py",
            returncode=pytest.ExitCode.USAGE_ERROR,
        )
    finally:
        probe.close()


# Session-scoped: an unauthenticated client holds no state worth resetting, so
# one instance can serve every test. Tests must never log in with it; tests
# that need a session get their own client.
@pytest.fixture(scope="session")
def api(settings: Settings) -> Iterator[RealEstateApi]:
    """A client with no session cookie: what a guest browsing the site sends."""
    client = RealEstateApi(settings.base_url, settings.request_timeout)
    yield client
    client.close()


def _login_problem(client: RealEstateApi, settings: Settings) -> str | None:
    """Log `client` in as the test admin. Returns None on success, or an explanation."""
    response = client.login(settings.admin_email, settings.admin_password)
    if response.status_code == 200:
        return None
    return (
        f"The test admin {settings.admin_email} could not log in (HTTP {response.status_code}).\n"
        f"  - Did you run `python scripts/seed_test_admin.py`?\n"
        f"  - Is the server running from `python scripts/run_test_server.py`? A server started\n"
        f"    with the real backend/.env is connected to the real auth DB, where this admin doesn't exist."
    )


# Session-scoped: log in ONCE and share the logged-in client with every test
# that needs admin rights.
#   + One login per run instead of one per test (each login is a bcrypt check
#     plus a round trip to Atlas) and one request against the login rate limit.
#   - Every test shares one cookie jar. A test that logs out, swaps the token,
#     or logs in as someone else with this client breaks every test that runs
#     after it, and only in that order. Tests that change the session must use
#     `logged_in_client` instead.
# Full reasoning in LEARNING_NOTES.md, "The admin_api fixture".
@pytest.fixture(scope="session")
def admin_api(settings: Settings) -> Iterator[RealEstateApi]:
    """A client logged in as the test admin, shared by the whole run. Never change its session."""
    client = RealEstateApi(settings.base_url, settings.request_timeout)
    problem = _login_problem(client, settings)
    if problem:
        # An environment problem, not a test failure: stop instead of reporting
        # the same login error once for every admin test.
        pytest.exit(problem, returncode=pytest.ExitCode.USAGE_ERROR)
    yield client
    client.close()


# The three environment checks, in order: config is safe → server answers →
# test admin can log in. Asking for require_server_reachable explicitly makes
# pytest run that check first, so a stopped server gives the "not reachable"
# message instead of a connection error from the login.
#
# Without this fixture, admin_api would first run when the first admin test
# needs it. Tests that log in on their own would already have failed by then,
# and the useful "run the seed script" message would come last, after a
# screenful of failures.
@pytest.fixture(scope="session", autouse=True)
def require_test_admin_login(require_server_reachable: None, admin_api: RealEstateApi) -> None:
    """Stop the run up front if the test admin can't log in (admin_api does the check)."""


# Upper bound on GET /api/search results (`.limit(1000)` in PropertyService.js).
# The leak check lists all properties through it, so it only works below this size.
SEARCH_RESULT_CAP = 1000


def _all_properties(api: RealEstateApi) -> dict[str, str]:
    """{id: city} for every property in the test DB, via the public search endpoint."""
    response = api.search_properties()
    assert_status(response, 200)
    properties = response.json()["data"]
    if len(properties) >= SEARCH_RESULT_CAP:
        pytest.exit(
            f"The test database holds {SEARCH_RESULT_CAP}+ properties, more than the leak check "
            f"can list through /api/search. Clean out {api.base_url}'s test database.",
            returncode=pytest.ExitCode.USAGE_ERROR,
        )
    return {prop["_id"]: prop["city"] for prop in properties}


@pytest.fixture(scope="session", autouse=True)
def require_no_leaked_properties(
    require_test_admin_login: None, api: RealEstateApi, admin_api: RealEstateApi
) -> Iterator[None]:
    """Fail the run if it leaves the test database different from how it found it.

    Snapshot every property id before the first test and compare after the
    last one. Compared against the snapshot, not "must be empty", so leftovers
    from an earlier interrupted run don't fail this run. They only must not grow.
    """
    before = _all_properties(api)
    yield
    after = _all_properties(api)

    leaked = {pid: city for pid, city in after.items() if pid not in before}
    destroyed = {pid: city for pid, city in before.items() if pid not in after}
    problems = []
    if leaked:
        # Deleted now so the next run starts clean. The run still fails, because
        # whatever created them has a cleanup bug that needs fixing.
        for pid in leaked:
            admin_api.delete_property(pid)
        problems.append(
            f"{len(leaked)} properties were created during this run and never deleted "
            f"(now removed by this check): {leaked}"
        )
    if destroyed:
        problems.append(
            f"{len(destroyed)} properties that existed before the run are gone. "
            f"A test deleted data it didn't create: {destroyed}"
        )
    if problems:
        pytest.fail("Test data leak check failed:\n  " + "\n  ".join(problems))


class PropertyCleanup:
    """The ids of properties one test created, to be deleted after it."""

    def __init__(self) -> None:
        self.ids: list[str] = []

    def add(self, property_id: str) -> None:
        self.ids.append(property_id)

    def add_if_created(self, response: requests.Response) -> None:
        """Register the property a create request made, if it made one.

        For tests that send a payload the server SHOULD reject. When a
        validation bug lets it through (201), the property still gets cleaned
        up. Call it straight after the request and BEFORE asserting: once the
        assertion fails, no later line in the test runs.
        """
        if response.status_code == 201:
            self.add(response.json()["_id"])


@pytest.fixture
def property_cleanup(admin_api: RealEstateApi) -> Iterator[PropertyCleanup]:
    """Every property registered here is deleted after the test, pass or fail."""
    cleanup = PropertyCleanup()

    # pytest runs the code after `yield` whether the test passed or failed; the
    # test's exception never enters this function. The try/finally is for
    # everything else: if the fixture itself is closed without being resumed
    # (an interrupted run, a teardown error in a fixture torn down first), the
    # cleanup still runs.
    try:
        yield cleanup
    finally:
        # Try every delete, even if an earlier one fails, so one failure doesn't
        # leak the rest. Collect problems and report them together at the end.
        problems = []
        for property_id in cleanup.ids:
            try:
                response = admin_api.delete_property(property_id)
            except requests.exceptions.RequestException as error:
                problems.append(f"{property_id}: {type(error).__name__}")
                continue
            # 404 is fine: the test deleted it itself (e.g. the delete test).
            if response.status_code not in (200, 404):
                problems.append(f"{property_id}: HTTP {response.status_code}")
        if problems:
            # Raised in teardown, this is reported as a separate ERROR next to the
            # test's own result. It can't replace a test failure: pytest records
            # the call phase and the teardown phase independently.
            pytest.fail(f"Teardown could not delete {len(problems)} created properties: {problems}")


@pytest.fixture
def make_property(admin_api: RealEstateApi, property_cleanup: PropertyCleanup) -> Callable[..., dict]:
    """Factory: create properties through the API; every one is deleted after the test.

    `make_property()` uses a valid default payload; `make_property(payload)`
    sends yours. Returns the created property as the server sent it back.
    """

    def _make(payload: dict | None = None) -> dict:
        response = admin_api.create_property(payload or property_payload())
        # If this fails, the property wasn't created, so there is nothing to clean up.
        assert_status(response, 201)
        created = response.json()
        # Registered the moment it exists, before anything else can fail.
        property_cleanup.add(created["_id"])
        return created

    return _make


@pytest.fixture
def created_property(make_property: Callable[..., dict]) -> dict:
    """One valid property that exists for the duration of the test and is deleted afterwards."""
    return make_property()


@pytest.fixture
def make_client(settings: Settings) -> Iterator[Callable[[], RealEstateApi]]:
    """Factory for fresh, private clients (empty cookie jar). All are closed after the test.

    For tests that need more than one client, or a client whose session they
    are free to change.
    """
    clients: list[RealEstateApi] = []

    def _make() -> RealEstateApi:
        client = RealEstateApi(settings.base_url, settings.request_timeout)
        clients.append(client)
        return client

    yield _make
    for client in clients:
        client.close()


@pytest.fixture
def logged_in_client(make_client: Callable[[], RealEstateApi], settings: Settings) -> RealEstateApi:
    """A fresh client logged in as the test admin, private to one test.

    Function-scoped (the default): costs a login per test, but the test may
    log out or otherwise change the session without affecting anyone else.
    """
    client = make_client()
    problem = _login_problem(client, settings)
    if problem:
        pytest.fail(problem)
    return client
