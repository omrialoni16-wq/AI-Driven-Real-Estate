# Real Estate API: Test Suite

An automated test suite, in Python and pytest, for the backend of this repo's real estate app (a Node/Express/MongoDB API). It treats the app as a black box: it starts the server against separate test databases, sends real HTTP requests, and checks the responses.

It covers login and session handling, admin-only authorization, creating/editing/deleting listings, input validation, search, filtering and pagination, plus contract checks for the two endpoints that call outside services.

**A normal run ends with `45 passed, 15 xfailed`.** The 15 *xfailed* ("expected to fail") tests aren't broken tests. Each one asserts the correct behaviour for a real bug found in the API and documented in [FINDINGS.md](FINDINGS.md), so it fails for exactly that reason. When a bug gets fixed, its test starts passing and the run fails on purpose, as a reminder to remove the marker.

---

## Quick start

**You need:** Python 3.12+, Node.js 18+, and access to the two MongoDB clusters the app uses (the suite creates its own `_test` databases on them).

```bash
# 1. Backend dependencies (once)
cd backend && npm install && cd ..

# 2. Python environment (once)
cd api-tests
python3.12 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3. Configuration (once)
cp .env.example .env                 # then fill in the values, see below
python config.py                     # prints "Config OK", or exactly what's wrong

# 4. The test admin account (once, see "Create the test admin")
python scripts/seed_test_admin.py

# 5. Every time: start the test server in one terminal...
python scripts/run_test_server.py

# ...and run the tests in another (after `source .venv/bin/activate`)
pytest
```

### Filling in `.env`

| Variable | What to put there |
|---|---|
| `API_BASE_URL` | `http://localhost:5001`. Must be localhost. |
| `TEST_MONGO_URI` | The properties cluster's connection string, with the database name ending in `_test` (e.g. `.../Properties_test`) |
| `TEST_AUTH_MONGO_URI` | The users cluster's connection string, database ending in `_test` (e.g. `.../RealEstateApp_test`) |
| `TEST_JWT_SECRET` | Any random string of 32+ characters: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` | The account the tests log in as. It's created by the seed script, so choose any values. |
| `REQUEST_TIMEOUT_SECONDS` | Optional, default 10 |

`.env` is gitignored. Never commit it.

### Create the test admin

The tests log in as `TEST_ADMIN_EMAIL`, so that account must exist in the **test** auth database:

```bash
python scripts/seed_test_admin.py
```

Run it **once** after filling in `.env`, and **again** if you change the admin email or password or if the test auth database is wiped. It's safe to run any number of times: it creates the admin if missing and otherwise updates the password. If you forget it, the suite stops with a message telling you to run it.

---

## Running tests

| What | Command |
|---|---|
| Everything | `pytest` |
| Fast run, no third-party calls (Groq, Nominatim) | `pytest -m "not external"` |
| Only the third-party contract tests | `pytest -m external` |
| One file | `pytest tests/test_auth.py` |
| One test | `pytest "tests/test_auth.py::test_expired_token_is_rejected_with_401"` |
| Tests whose name matches | `pytest -k pagination` |
| Verbose, one line per test | `pytest -v` |
| See the known bugs actually fail | `pytest --runxfail` (ignores the xfail markers) |
| Show the HTTP calls of passing tests too | `pytest -rA` |

### Reports

Every run writes two reports to `reports/` (gitignored, overwritten on each run, including by `--collect-only`):

- `reports/report.html`: open it in a browser. Per-test results, captured HTTP logs, durations, and the tested environment (URL and database names, never credentials).
- `reports/junit.xml`: for CI systems. JUnit has no "expected failure" status, so the 15 xfails appear there as *skipped*, with the finding as the reason.

### The suite at a glance: `pytest --collect-only`

`--collect-only` lists every test without running anything (no server needed). Trimmed output:

```
<Dir tests>
  <Module test_health.py>                   2  smoke: is the API up and answering?
  <Module test_auth.py>                    15  login, cookie, logout, token expiry, register (negative paths only)
    <Function test_login_with_bad_credentials_is_rejected_with_the_same_401[registered email, wrong password]>
    <Function test_login_with_bad_credentials_is_rejected_with_the_same_401[unregistered email]>
    ...
  <Module test_authorization.py>           10  every admin endpoint refuses guests; every kind of bad token is refused
    <Function test_protected_endpoint_answers_401_to_a_guest_but_not_to_an_admin[DELETE /api/properties/:id]>
    <Function test_session_cookie_with_an_invalid_token_is_rejected_with_401[unsigned, header says "alg": "none"]>
    ...
  <Module test_properties_crud.py>          4  create, read back, update, delete
  <Module test_search_and_filtering.py>    11  filters, search, pagination, regex and number-parsing bugs
  <Module test_validation.py>              16  bad input gets a 4xx, not a 500 or a silent success
  <Module test_external_services.py>        2  AI chat and geocoding: contract only (marked external)
========================= 60 tests collected =========================
```

How to read it: each `<Function>` is one test case. A name in `[brackets]` is one case of a parametrized test: the same test function run with different inputs, shown with a readable id. The names are meant to read as sentences, so this list works as a specification of the API.

---

## Reading a failure

A failing test shows what was expected, what came back, and the HTTP calls that led there:

```
    def test_updating_a_property_with_an_invalid_value_is_rejected_with_400_and_not_saved(...):
>       assert_status(response, 400)
E       AssertionError: Expected 400 from PUT http://localhost:5001/api/properties/6ab6…, got 500.
E       Response body: {"message":"Error updating property","error":"Validation failed: rooms: ..."}

------------------------------ Captured log call -------------------------------
INFO     api:base_client.py:43 PUT http://localhost:5001/api/properties/6ab6… -> 500 (41 ms)
```

Read it top-down: the `>` line is where it failed, the `E` lines are the expected and actual values, and the captured log is the sequence of requests. Cookies, tokens and passwords never appear in logs or reports; they're redacted.

---

## When something's wrong

The suite checks its environment before running any test, and stops with **one** message instead of a wall of failures:

| Message | Meaning / fix |
|---|---|
| `Configuration error: ... must end with '_test'` | A database name in `.env` isn't a test database. This is the safety rail; see below. |
| `Configuration error: Missing required variables: ...` | Fill in `.env`. `python config.py` checks it on its own. |
| `API not reachable at http://localhost:5001` | Start the test server: `python scripts/run_test_server.py` |
| `The test admin ... could not log in` | Run `python scripts/seed_test_admin.py`. If you did, the server may have been started some other way; use the script. |
| `Test data leak check failed` | A test created or deleted properties without cleaning up. The message lists them; leaked ones are removed automatically. |
| An `XPASS(strict)` failure | A known bug has been fixed. Remove the `@known_bug` marker from that test and the entry from FINDINGS.md. |

## Safety rails

The suite creates and deletes data, so it refuses to run unless:

- `API_BASE_URL` points at localhost, **and**
- both database names in `TEST_MONGO_URI` and `TEST_AUTH_MONGO_URI` end with `_test`.

The same check guards the seed script and the test-server launcher. Always start the server with `scripts/run_test_server.py`: it passes the checked test databases to the backend, overriding `backend/.env`. That's what guarantees the server the tests talk to is the one the check approved.

After every run, a leak check confirms the test database holds exactly the properties it held before.

---

## Layout

```
api-tests/
├── config.py               settings from .env, plus the safety guard
├── conftest.py             fixtures: environment checks, clients, test data with cleanup, leak check
├── assertions.py           assert_status(): readable status-code failures
├── findings.py             known_bug(): the strict-xfail marker, tied to FINDINGS.md
├── client/
│   ├── base_client.py      requests.Session wrapper: URLs, timeout, logging
│   ├── real_estate_api.py  one method per endpoint; the only file that knows the API's paths
│   └── redaction.py        keeps tokens, cookies and passwords out of logs and reports
├── data/
│   ├── factories.py        valid payloads with unique values, plus invalid variants
│   └── tokens.py           JWT builders: expired, tampered, wrong secret, alg:none
├── scripts/
│   ├── run_test_server.py  starts the backend against the test databases (port 5001)
│   └── seed_test_admin.py  creates or updates the test admin (idempotent)
├── tests/                  the tests (see --collect-only above)
├── FINDINGS.md             the bugs this suite found, with reproduction steps
└── LEARNING_NOTES.md       how and why it's built this way
```

## Further reading

- [FINDINGS.md](FINDINGS.md): the 14 weaknesses found, grouped and with reproduction steps.
- [LEARNING_NOTES.md](LEARNING_NOTES.md): the design, file by file, with the trade-offs behind each decision.
