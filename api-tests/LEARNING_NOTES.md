# Learning Notes

What this test suite is, how it's built, and why each decision was made. It's written to be read top to bottom once, then used as a reference, and section 7 as an interview cheat sheet.

1. [The big picture](#1-the-big-picture)
2. [A file-by-file tour](#2-a-file-by-file-tour)
3. [Fixtures, properly](#3-fixtures-properly)
4. [Why the client layer exists](#4-why-the-client-layer-exists)
5. [Test design](#5-test-design)
6. [The commands you need](#6-the-commands-you-need)
7. [Design decisions and trade-offs](#7-design-decisions-and-trade-offs)
8. [Interview questions](#8-interview-questions)
9. [What I'd build next](#9-what-id-build-next)

---

## 1. The big picture

### What an API test framework is

The backend is a program that answers HTTP requests: `POST /api/auth/login` with an email and password gets back a cookie, `GET /api/properties?city=Haifa` gets back a list. An **API test** sends such a request and checks the answer: the status code, the fields that matter, and any side effect (was the property really saved?).

A **framework** is the structure that makes hundreds of such tests cheap to write and trustworthy to run. It means:

- **one place** that knows how to talk to the API (the client layer);
- **one place** for configuration, so the same tests run against any environment;
- **fixtures** that create what a test needs and clean it up afterwards;
- **guards** that stop a run early and clearly when the environment is wrong;
- **reports** a human and a CI system can both read.

Without the framework, each test would repeat URLs, login steps and cleanup code, and the first change to any of them would break dozens of tests at once.

### Why the tests live outside the app and talk to it over HTTP

The tests are in Python; the app is in JavaScript. They share nothing but HTTP, and that's deliberate:

- **They test what users actually get.** A request goes through Express, CORS, helmet, the JSON body parser, the rate limiter, the auth middleware, the controller, Mongoose and MongoDB, exactly as it would from the browser. A unit test of the controller would skip all of that. Several findings (F6, F7) live precisely in that middle layer and would be invisible to unit tests.
- **They survive refactoring.** The backend could be rewritten in Go tomorrow; as long as the HTTP contract holds, not one test changes.
- **The language doesn't matter.** HTTP is the interface, so the test language is a team choice. Python/pytest is what most SDET/QA automation roles use, which is why this suite uses it.

The price: black-box tests are slower than unit tests (each one is a network round trip and a database write) and can't directly see internal state. Section 5 shows how the suite works around that: reading data back through public endpoints, and using controls to make each result conclusive.

### What happens when you type `pytest`

1. pytest reads `pytest.ini` (where the tests are, which options to use) and loads `conftest.py`.
2. It **collects** the tests in `tests/`: 60 test cases from 39 test functions.
3. Before the first test, three **environment checks** run, in order: the config points at a safe target; the server answers; the test admin can log in. Any failure stops the whole run with one message.
4. The **leak check** takes a snapshot of every property in the test database.
5. Each test runs with the fixtures it asked for: clients, created properties, and so on. Its fixtures clean up after it.
6. After the last test, the leak check compares the database against the snapshot.
7. pytest writes `reports/report.html` and `reports/junit.xml` and prints `45 passed, 15 xfailed`.

---

## 2. A file-by-file tour

For each file: what it does, why it exists, and what would go wrong without it.

| File | What it does | Without it |
|---|---|---|
| **`pytest.ini`** | Where tests live, default options (`-ra`, `--strict-markers`, reports), the `external` marker, log capture level | Every run would need the same flags typed by hand; a misspelled marker would silently match nothing |
| **`config.py`** | Reads `.env` into one frozen `Settings` object, and refuses to return it unless the target is localhost and both database names end in `_test` | URLs and credentials scattered across tests; nothing stopping a run against real data |
| **`conftest.py`** | All shared fixtures: the environment checks, clients, test data with cleanup, the leak check, and report hooks | Every test would repeat login and cleanup code; a stopped server would produce 60 identical connection errors |
| **`assertions.py`** | `assert_status(response, expected)`: on failure, prints method, URL, expected vs. actual status, and the (redacted) body | Failures read `assert 500 == 400`, with no idea which request or why |
| **`findings.py`** | `known_bug("F8", ...)`: the strict, narrow xfail marker. Refuses ids missing from FINDINGS.md | Inconsistent xfail markers, some hiding unrelated errors, drifting away from the findings document |
| **`client/base_client.py`** | A thin wrapper over `requests.Session`: joins URLs, applies the default timeout, logs every request and response (redacted) | Every test builds URLs by hand; a hung server freezes the suite forever; no HTTP trail in failure reports |
| **`client/real_estate_api.py`** | One method per endpoint (`login`, `create_property`, …) plus session-cookie helpers. The only file that knows the API's paths | An endpoint rename means editing every test that calls it (section 4) |
| **`client/redaction.py`** | Masks Cookie / Set-Cookie / Authorization headers and JWT-shaped text; parses cookie attributes without the value | A session token (3 hours of admin access) ends up in an HTML report uploaded as a CI artifact |
| **`data/factories.py`** | Builds payloads: a valid property with a unique, alphanumeric city; variants invalid in one way; register payloads | Tests collide on shared values; hand-written payloads drift from the schema |
| **`data/tokens.py`** | Builds JWTs: re-signed with a chosen expiry, tampered, wrong secret, `alg: none` | No way to test expiry or forged tokens without waiting 3 hours or hand-crafting base64 |
| **`scripts/run_test_server.py`** | Starts `node server.js` with the *test* databases, port 5001, `NODE_ENV=test`, a raised rate limit, all read from the same checked `.env` | The config guard would check a file, not the server; nothing guarantees the server uses test data |
| **`scripts/seed_test_admin.py`** | Creates or updates the test admin in the test auth DB (idempotent upsert + unique index) | No way to log in on a fresh database: registering needs an existing admin |
| **`tests/test_health.py`** | 2 smoke tests: listing works (DB up), `/me` answers 401 JSON (server up, no DB) | When everything fails, no quick way to tell "server down" from "DB down" |
| **`tests/test_auth.py`** | 15 cases: login, cookie flags, uniform 401s, logout, expired token, register (negative only), F13 | — |
| **`tests/test_authorization.py`** | 10 cases: every protected endpoint refuses a guest; every bad-token kind is refused | — |
| **`tests/test_properties_crud.py`** | 4 cases: create, read back, update, delete | — |
| **`tests/test_validation.py`** | 16 cases: invalid fields, oversized/malformed bodies, CORS, bad ids, chat body | — |
| **`tests/test_search_and_filtering.py`** | 11 cases: filters, search, tags, pagination, regex/number-parsing bugs | — |
| **`tests/test_external_services.py`** | 2 `external` cases: chat and geocoding, contract only | — |
| **`FINDINGS.md`** | The 15 weaknesses found, grouped, with severity and reproduction steps | Bugs found by the suite live only in test names |
| **`.env.example`** | Every variable, with placeholders and comments | A new machine has to guess the configuration |
| **`../.github/workflows/api-tests.yml`** | Runs the suite on every push and pull request against a throwaway MongoDB, and uploads the reports (section 7.5) | The suite only runs when someone remembers to run it |

One app change was made for testability (`AUTH_RATE_LIMIT_MAX`, section 7.2) and one bug fix (the `PropertyController.js` import case, which would have crashed the server on Linux/CI).

---

## 3. Fixtures, properly

### What a fixture is

A fixture is a function that prepares something a test needs. The test asks for it by **naming it as a parameter**, and pytest calls the fixture and passes the result in:

```python
@pytest.fixture
def created_property(make_property):
    return make_property()

def test_deleting_a_property_removes_it(..., created_property):   # ← asked for by name
    admin_api.delete_property(created_property["_id"])
```

The test doesn't know *how* the property was made, and doesn't clean it up. That's the point: setup and cleanup code is written once and reused everywhere. Fixtures can ask for other fixtures (`created_property` asks for `make_property`, which asks for `admin_api` and `property_cleanup`), and pytest works out the order.

### `yield`: setup, then teardown

A fixture that uses `yield` instead of `return` has two halves:

```python
@pytest.fixture
def property_cleanup(admin_api):
    cleanup = PropertyCleanup()        # ← setup: runs before the test
    try:
        yield cleanup                  # ← pytest pauses here and runs the test
    finally:
        for property_id in cleanup.ids:    # ← teardown: runs after the test
            admin_api.delete_property(property_id)
```

**Setup** is everything before `yield`. pytest then pauses the fixture, runs the test with the yielded value, and afterwards resumes the fixture: everything after `yield` is **teardown**.

**Three precise facts about teardown** (the first one is commonly misunderstood):

1. **Teardown runs even when the test fails, with or without `try/finally`.** The test's exception never enters the fixture: pytest records the failure and resumes the fixture normally. `finally` adds cover for the remaining cases, where the fixture is closed *without* being resumed (an interrupted run, pytest aborting teardown), and it makes the guarantee visible in the code.
2. **Teardown does *not* run if setup never finished.** If a fixture raises between creating something and reaching `yield`, that something leaks. That's the real risk, and it's why `make_property` registers each property's id *the moment it's created*, before anything else can fail.
3. **A teardown error doesn't hide a test failure.** pytest records setup, call and teardown separately. We verified it: a test that failed *and* whose cleanup failed was reported as both `FAILED` (the test's assertion) and `ERROR` (the cleanup).

### Scopes: how long a fixture's result lives

| Scope | Created | Torn down | Used here for |
|---|---|---|---|
| `function` (default) | once per test | after that test | anything a test may change: created properties, fresh clients, a private logged-in client |
| `session` | once per run | after the last test | expensive or global things: settings, the guest client, the shared admin login, environment checks, the leak check |

(pytest also has `module`, `class` and `package` scopes; this suite doesn't need them.)

The rule: **the wider the scope, the more tests share the object, so the less any test may change it.** A function-scoped fixture is private to one test; a session-scoped one is shared by all of them.

`autouse=True` makes a fixture apply to every test without being asked for. The environment checks and the leak check use it, so no test can forget them.

### The fixtures in this suite

| Fixture | Scope | Provides |
|---|---|---|
| `settings` | session, autouse | Validated settings; stops the run if the target isn't safe |
| `require_server_reachable` | session, autouse | Stops the run with one message if nothing answers |
| `require_test_admin_login` | session, autouse | Stops the run if the test admin can't log in (e.g. seed not run) |
| `require_no_leaked_properties` | session, autouse | Snapshots properties before the run; fails the run if they changed |
| `api` | session | A guest client (no cookie). Never logged in with |
| `admin_api` | session | A client logged in as the test admin, shared. Its session is never changed |
| `make_client` | function | A factory for fresh private clients, all closed after the test |
| `logged_in_client` | function | A private client logged in for one test, which may log out etc. |
| `property_cleanup` | function | A registry; every property id in it is deleted after the test |
| `make_property` | function | A factory: creates properties and registers each for cleanup |
| `created_property` | function | One valid property, deleted after the test |

The three environment checks run in a fixed order (config → server → admin login) because each one names the previous as a parameter. With the server down, you get "not reachable", not a connection error from the login.

### The `admin_api` trade-off: session scope and shared state

`admin_api` logs in **once per run**, and every test that needs admin rights gets the same client object, with the same cookie jar.

**What that buys:** one login instead of one per test. Each login is a bcrypt check (deliberately slow) plus a round trip to Atlas, and it counts against the login rate limit.

**What it costs: shared mutable state.** The client is an object whose cookie jar changes when you use it. If one test mutates it, a different test fails:

```python
def test_logout_works(admin_api):        # WRONG: uses the shared client
    admin_api.logout()                   # the shared cookie jar is now empty
    assert admin_api.me().status_code == 401

def test_admin_can_create_property(admin_api):
    response = admin_api.create_property(...)   # 401! No longer logged in.
```

The second test fails even though nothing is wrong with creating properties, and **only when it runs after the first one**. Run it alone and it passes; change the test order and the failure moves. That's an *order-dependent* test, one of the most expensive kinds of flakiness to debug, because the failing test is innocent and the guilty one passed.

**How this suite prevents it:**

- `admin_api` is never used to change a session. Tests that log out, swap tokens or log in again use `logged_in_client` (a private, function-scoped login) or `make_client`.
- Every login *attempt* goes through a fresh client. If a bug let a wrong password log in, a shared client would quietly become an admin client for every later "guest" test.
- This is a convention, not enforcement. To enforce it, `admin_api` could be a wrapper whose `logout()` and `use_token()` raise, or an autouse fixture could check after each test that `admin_api.me()` still returns 200. At this size the convention is enough.

**When you'd switch it to function scope:**

1. **Logout starts revoking tokens on the server.** If F13 is fixed so logout kills *all* of a user's sessions, a `logged_in_client` logout would also kill `admin_api`, because both are the same user. Switch scope, or give the shared client its own account.
2. **Tests need different users or roles.** One shared login can't represent them.
3. **A shared login stops being safe to share,** e.g. very short token lifetimes.
4. **To debug a suspected order-dependency:** switch temporarily; if the flakiness disappears, some test is mutating shared state.

Parallel runs with `pytest-xdist` are *not* a reason by themselves: each worker process gets its own session fixtures, so each worker logs in once.

### Factory fixtures: `make_property` and `property_cleanup`

`make_property` doesn't create *a* property: it returns a *function* that creates as many as a test needs, each one registered in `property_cleanup` for deletion. `created_property` is the one-property shortcut. `property_cleanup` also accepts ids directly, for tests that create data *by accident*:

```python
response = admin_api.create_property(payload)   # should be rejected...
property_cleanup.add_if_created(response)       # ...but if a bug returns 201, clean it up
assert_status(response, 400)                    # only now assert
```

The order matters: **register before asserting.** Once an assertion fails, no later line in the test runs.

Teardown tries every delete even if an earlier one fails, collects the problems, and reports them together, so one failed delete doesn't leak the rest. A `404` during teardown is fine: the test may have deleted the property itself.

---

## 4. Why the client layer exists

**Without a client layer,** each test talks to `requests` directly:

```python
# test_properties_crud.py
def test_create(...):
    r = requests.post(f"{BASE_URL}/api/properties", json=payload, cookies={"token": token}, timeout=10)

# test_validation.py
def test_negative_price(...):
    r = requests.post(f"{BASE_URL}/api/properties", json=bad, cookies={"token": token}, timeout=10)

# test_authorization.py
def test_guest_cannot_create(...):
    r = requests.post(f"{BASE_URL}/api/properties", json={}, timeout=10)

# ...and 20 more places that know "/api/properties", the cookie name, and the timeout.
```

Now the backend renames the route to `/api/v2/listings`. You search every test file for `/api/properties` (also matching `/api/properties/:id/location`, which may *not* have moved), edit each call, and hope you found them all. If the cookie is renamed from `token` to `session`, it's the same hunt again.

**With the client layer:**

```python
# client/real_estate_api.py: the only file that knows paths
def create_property(self, payload):
    return self.post(f"{API}/properties", json=payload)     # ← change here, once

# every test
response = admin_api.create_property(payload)
```

The rename is a **one-line change in one file**, and no test changes. The same goes for the cookie name (`SESSION_COOKIE`), the timeout, and logging.

What else the layer gives for free, because every request passes through one place:

- **A default timeout** on every request, so a hung server fails a test instead of freezing the run.
- **Logging of every request** (method, URL, status, duration). pytest attaches it to failing tests, so the failure report shows the exact HTTP sequence.
- **Redaction**: tokens and cookies are masked in every log line, so no test can forget.
- **Readable tests**: `admin_api.update_property(id, changes)` says what happens; `requests.put(f"{BASE}/api/properties/{id}", ...)` says how.

The client deliberately **doesn't raise on 4xx/5xx** (`raise_for_status()`): a 401 or 404 is often exactly what a test expects, so judging the response is the test's job.

---

## 5. Test design

### What makes a good test case

**One reason to fail.** Each validation payload is valid *except for one field*, so a 400 can only be about that field, and the test checks the error names it. A payload with three problems proves the server rejects *something*, not that it checks each rule.

**Assert on meaning, not noise.** Tests check the status code plus the fields that matter (`body["user"]["email"]`, the set of returned ids), never whole-body equality. That would break every time the API adds a field, and a test that breaks for irrelevant reasons teaches people to ignore failures.

**Use a control.** A result only means something if you know what it would be otherwise:

- *Expired token:* a naive test signs a token for user `"fake"` with a past expiry and expects 401. It passes even if the server **never checks expiry**, because user `"fake"` doesn't exist. Our test signs two tokens with the admin's *real* claims, identical except for `exp`. It first asserts the unexpired one is **accepted** (the control), so a 401 for the expired one can only be because of expiry.
- *Authorization:* each endpoint test first sends the request *as the admin* and checks it gets past authentication (400/404/200), and only then checks a guest gets 401. Without the control, a typo in the path (404 for everyone) could make the test pass or fail for the wrong reason.

**Use a minimal pair.** The tag-filter test (F11) runs the same filter two ways: two tags (`?tags=a&tags=b`, passes) and one tag (`?tags=a`, fails). The only difference is how the query string encodes the value, so the pair locates the bug without reading the backend.

**Ask: would this fail if the behaviour were missing?** The first location test called `/location` twice and asserted identical coordinates, to "prove" the second call came from the database. It proved nothing: Nominatim returns the same coordinates for the same address either way, so the test would pass with or without the cache. The final version reads the property back and checks `lat`/`lng` are *stored on it*, which is observable and would fail without the side effect.

### Independence: any test, alone, in any order

Every test creates its own data and never depends on another test's:

- **Unique data.** Each property gets a city like `Testcity3f9a1c0b7e2d`, so searching that city finds exactly that test's data, whatever else is in the database. The city is strictly alphanumeric because the backend turns the city filter into a regular expression (F3): a `.` or `(` in test data would change the search's meaning.
- **Own fixtures.** `created_property` is function-scoped: every test gets a fresh one.
- **Shared objects are read-only.** `api` and `admin_api` are shared; no test changes their sessions.
- **Checked:** each file and individual tests pass on their own (`pytest "tests/test_properties_crud.py::test_deleting_..."`).

### Repeatability: same result every run

- **Cleanup** by fixtures, including data created *by accident* (bugs that return 201).
- **The leak check** snapshots all property ids before the run and compares after: it fails the run for leaked data (and deletes it) or for destroyed data. Leaked data never fails the run that leaks it; it fails some *later* run in some other test, which is irreproducible by the time anyone looks. The leak check turns that into an immediate failure that names the ids. It compares against the snapshot, not "must be empty", so leftovers from an interrupted run don't fail an innocent run.
- **The rate limiter** (10 logins / 15 min) would fail the second run with 429s; the test server raises it via a config variable (section 7.2).
- **Idempotent setup:** the seed script can run any number of times.
- **Checked:** two full runs in a row, same result, 0 properties left.

### Flaky tests, and how this design avoids them

A **flaky test** passes and fails on the same code. It's worse than no test: people learn to rerun until green, and then ignore real failures too. Common causes, and what this suite does:

| Cause | Here |
|---|---|
| Order dependency / shared state | Private data per test; shared clients never mutated |
| Leftover data from earlier runs | Unique values; cleanup; leak check |
| External services | Isolated in one file, marked `external`, excluded with `-m "not external"` |
| Timing (`sleep`, race conditions) | No sleeps; every assertion is on a finished HTTP response |
| Hung requests | Default timeout on every request |
| Environment surprises | Three checks stop the run before any test |

**One residual risk, stated honestly:** the listing endpoint sorts only by `createdAt`. If two properties in the pagination test got the *same* timestamp, the database could order them differently between the two page queries, and a property could appear on both pages. It doesn't happen in practice (the three creates are sequential HTTP calls, milliseconds apart), but a sort with a tie-breaker (`createdAt, _id`) would remove the risk. That's a small backend improvement, not a test fix.

### Known bugs: strict, narrow xfails

A **known bug** is not the same as a failing test. A failing test says "something broke, look now". A known bug says "we know, it's documented, it's not today's problem". If the suite is red for known bugs, a *new* failure hides among them. If the bug tests are deleted, nobody notices when a fix lands or regresses.

So each known bug gets a test that asserts the **correct** behaviour, marked `@known_bug("Fn", ...)`:

- `xfail`: expected to fail; reported as `XFAIL`, and the run stays green.
- `strict=True`: if the test *passes* (the bug was fixed), the run **fails** (`XPASS(strict)`), forcing someone to remove the marker and the finding. A fix is never silent.
- `raises=AssertionError`: only a failed *assertion* counts as the known bug.

**A general rule for suppression markers** (xfail, skip, `except ...: pass`, `# noqa`, `filterwarnings`): *a suppression must be exactly as wide as the claim it makes, and must stop working when the claim stops being true.* We learned this the hard way. With plain `xfail(strict=True)`, a run with a broken admin password made the F13 test's fixture fail, and pytest still reported `XFAIL`: an unrelated error was counted as the known bug. xfail accepts *any* exception by default, including fixture errors.

| Failure mode | Symptom | Fix for xfail | Same idea elsewhere |
|---|---|---|---|
| **Too broad** | Unrelated errors hide behind the marker | `raises=AssertionError` | `except SpecificError`, `# noqa: E402`, filter one warning class |
| **Too long-lived** | The bug is fixed but the marker stays | `strict=True` | `skipif(condition)` instead of `skip` |

To check a suppression is narrow, make it fail for a *different* reason and confirm it's no longer silenced. `known_bug` also refuses ids that have no section in FINDINGS.md, so the tests and the document can't drift apart.

### Security-minded test design

- **Authorization in two grids** (details and the assumption behind it: section 7.3).
- **Harmless requests.** Every authorization request is an empty body or a nonexistent id. If an auth check were missing, the test would fail, but nothing could be created or deleted. A security test shouldn't be destructive when it finds the hole it's looking for.
- **Bad tokens carry real claims.** Tampered, wrong-secret and `alg: none` tokens all claim to be the real admin, so the signature check is the only thing between them and a login.
- **No user enumeration.** A wrong password and an unknown email must get the *same* 401 and message.
- **Secrets stay out of output.** A report gets uploaded, attached and pasted; a session token in it is 3 hours of admin access. The client never logs request bodies; Cookie / Set-Cookie / Authorization headers and any JWT-shaped text are masked. The less obvious leak is **pytest's own assertion introspection**: when `assert "HttpOnly" in set_cookie_header` fails, pytest prints the header, token included. So tests assert on `session_cookie_attributes()` (flags without the value) or on booleans, and pass tokens along without storing them in variables. Verified: a run with DEBUG logs, `--showlocals` and both reports contained zero `eyJ` (every JWT's prefix), while a raw login response contains it.

### What we deliberately don't test, and why

| Not tested | Why |
|---|---|
| **The chat model's wording** | It varies between identical calls by design. We test the contract (status, response shape, side effects) and the validation that runs *before* the model is called. |
| **F12, prompt injection** | Proving it means showing the model *obeyed* an injected instruction: a statistical claim (LLM evaluation), not a pass/fail test. |
| **F10, unbounded page size** | Needs thousands of properties to observe. Documented from code review. |
| **Successful admin registration** | Creates a user the API can't delete. Only rejections are tested. |
| **Actually triggering the rate limit (429)** | The test server raises the limit so the suite is repeatable; we check the limiter is active via its `RateLimit-*` headers instead. |
| **The frontend, performance, load** | Out of scope for an API functional suite (see section 9). |

### Why `/chat` and `/location` are harder to test

Most endpoints are a function of the request and the database, both of which the suite controls. These two aren't:

| Problem | `/api/chat` (Groq) | `/api/properties/:id/location` (Nominatim) |
|---|---|---|
| **Depends on someone else's service** | Groq's uptime, rate limits, API key | Nominatim's uptime and 1-request-per-second policy |
| **Costs something** | Tokens per call | Free, but abuse gets you blocked |
| **Non-deterministic** | Wording changes between identical calls | Mostly stable; map data can change |
| **Side effects** | The agent may *decide* to call `addProperty` and write to the DB | A `GET` that writes `lat`/`lng` to the property |

The options, and what we chose:

1. **Contract only, marked `external`** *(chosen for the happy path).* Status, shape (`reply` is non-empty text, `actionPerformed` is a boolean, the history ends with an assistant message) and side effects, never wording. If the model unexpectedly adds a property, its id is registered for cleanup before any assertion.
2. **Test the validation that runs before the external call** *(chosen, runs every time).* A chat request without `message` is rejected by an early return: fast, free, deterministic.
3. **Stub the external service** *(not chosen).* A fake Groq returning canned answers makes tests deterministic, but the Groq URL is hardcoded in the app, and you'd be testing your stub, not the integration. Worth it for many tests; not for two.
4. **Evaluate the model's behaviour** with many samples and thresholds, or a second model as judge *(out of scope).* That's LLM evaluation, a discipline of its own.

---

## 6. The commands you need

All from `api-tests/`, with the venv active and the test server running (`python scripts/run_test_server.py` in another terminal).

```bash
pytest                                        # everything: expect "45 passed, 15 xfailed"
pytest -m "not external"                      # skip Groq/Nominatim: fast, free, deterministic
pytest -m external                            # only the third-party contract tests
pytest tests/test_auth.py                     # one file
pytest "tests/test_auth.py::test_expired_token_is_rejected_with_401"   # one test
pytest "tests/test_auth.py::test_login_with_a_missing_field_is_rejected_with_400[email]"   # one parametrized case
pytest -k pagination                          # tests whose name contains "pagination"
pytest -v                                     # one line per test
pytest -x                                     # stop at the first failure
pytest --runxfail                             # ignore xfail markers: see each known bug actually fail
pytest --collect-only -q                      # list tests without running them
python config.py                              # check .env without running anything
```

Reports are written on every run: open `reports/report.html` in a browser; `reports/junit.xml` is for CI (where the xfails show as *skipped*, with the finding as the reason).

### Reading a failure

`pytest --runxfail -k invalid_value` shows the F2 bug failing for real:

```
_ test_updating_a_property_with_an_invalid_value_is_rejected_with_400_and_not_saved _

api = <client.real_estate_api.RealEstateApi object at 0x107724b00>
admin_api = <client.real_estate_api.RealEstateApi object at 0x10747ab10>
created_property = {'img': 'https://example.test/images/property.jpg', 'price': 2500000, 'street': 'Herzl 10', 'city': 'Testcity133f855877a0', ...}

    @known_bug("F2", "Mongoose ValidationError on update is caught as a 500")
    def test_updating_a_property_with_an_invalid_value_is_rejected_with_400_and_not_saved(api, admin_api, created_property):
        response = admin_api.update_property(created_property["_id"], {"rooms": -1})

        # Checked first, and passing today: the invalid value is NOT saved
        # (runValidators works). Only the status code is wrong.
        [stored] = api.search_properties(city=created_property["city"]).json()["data"]
        assert stored["rooms"] == created_property["rooms"], "invalid update was saved"

>       assert_status(response, 400)
E       AssertionError: Expected 400 from PUT http://localhost:5001/api/properties/6ab6570c233e578fbd5a80b0, got 500.
E       Response body: {"message":"Error updating property","error":"Validation failed: rooms: Path `rooms` (-1) is less than minimum allowed value (0)."}

tests/test_validation.py:93: AssertionError
------------------------------ Captured log setup ------------------------------
INFO     api:base_client.py:43 GET http://localhost:5001/api/auth/me -> 401 (1 ms)
INFO     api:base_client.py:43 POST http://localhost:5001/api/auth/login -> 200 (124 ms)
INFO     api:base_client.py:43 GET http://localhost:5001/api/search -> 200 (66 ms)
INFO     api:base_client.py:43 POST http://localhost:5001/api/properties -> 201 (73 ms)
------------------------------ Captured log call -------------------------------
INFO     api:base_client.py:43 PUT http://localhost:5001/api/properties/6ab6570c233e578fbd5a80b0 -> 500 (2 ms)
INFO     api:base_client.py:43 GET http://localhost:5001/api/search?city=Testcity133f855877a0 -> 200 (66 ms)
---------------------------- Captured log teardown -----------------------------
INFO     api:base_client.py:43 DELETE http://localhost:5001/api/properties/6ab6570c233e578fbd5a80b0 -> 200 (68 ms)
INFO     api:base_client.py:43 GET http://localhost:5001/api/search -> 200 (66 ms)
```

How to read it:

1. **The header** names the test; the name already says what was expected.
2. **The argument lines** (`api = ...`, `created_property = {...}`) are the fixture values the test received. This is also why tokens are never passed to tests as fixture arguments: pytest would print them here.
3. **The `>` line** is where it failed. Lines above it passed: here, the invalid value was *not* saved.
4. **The `E` lines** say what was expected (400), what came back (500) and the body, which explains why: the validation error was caught as a server error.
5. **Captured log setup** is the fixtures' work, in order. Because this test happened to run first, it includes the session-wide checks (server reachable → `/me` 401, admin login, leak-check snapshot) before `created_property` made its property (201).
6. **Captured log call** is the test's own requests: the failing PUT, then the read-back.
7. **Captured log teardown** is the cleanup deleting the property (200), then the leak check's final snapshot (because this was also the last test).

---

## 7. Design decisions and trade-offs

### 7.1 Cheat sheet: we chose X over Y because Z

**Architecture**

- **Python + pytest over JavaScript tests** because the interface is HTTP, so the language is free, and SDET roles ask for pytest.
- **Black-box over importing the app** because it tests the real request path (CORS, body parser, middleware) and survives refactoring; the cost is speed and no direct view of internals.
- **A client layer over `requests` in tests** because an endpoint change is one line in one file, and logging, timeouts and redaction can't be forgotten.
- **Returning raw `Response` over raising on errors** because a 401 is often the expected result; the test judges.
- **`assert_status` over bare `assert`s** because a failure must say which request, what came back and why, without rereading the test.

**Environment and safety**

- **`_test` databases on the existing Atlas clusters, guarded by name, over a local MongoDB** for local runs, because it needs nothing installed, and the guard (localhost + `_test` suffix, checked inside `load_settings()` so nothing can skip it) is the safety rail a real framework has. CI uses a throwaway MongoDB container instead (section 7.5).
- **A launcher script over "start the server however you like"** because the guard checks a file; starting the server from that same file is what makes the check mean something.
- **`pytest.exit` for environment problems over per-test failures** because a stopped server is one problem, not 60.
- **The test admin's login as an implicit check:** it exists only in the test auth DB, so a server started against the real database fails the login check.
- **A configurable rate limit over restarting the server between runs** (7.2).

**Fixtures and data**

- **Session-scoped `admin_api` over a login per test** because it's one login instead of dozens; the cost is shared state, handled by convention (section 3).
- **Factory fixtures over single-object fixtures** because tests need 0, 1 or 3 properties, and even accidental creations must be cleaned up.
- **A snapshot leak check over "the database must be empty"** because an earlier interrupted run shouldn't fail an innocent run.
- **Random unique values over fixed seed data** because fixed data collides between tests and runs; unique data makes every test independent.
- **Read-back via a unique-city search over GET-by-id** because there is no GET-by-id endpoint.
- **Register tests for negative paths only** because a successful register creates a user the API can't delete.

**Test design**

- **Strict, narrow xfails over red tests, skips or deleted tests** because the run stays green while every known bug stays tracked, and a fix can't go unnoticed (section 5).
- **Two authorization grids over a full cross-product** because of the shared middleware; the assumption this rests on is in 7.3.
- **Exactly 401 over `in (401, 403)`** because that's what the middleware returns; a looser assertion is a weaker test.
- **Contract-only tests for the LLM over asserting wording or stubbing** because wording is non-deterministic, and a stub tests the stub.
- **One `external` marker over also registering `slow`** because nothing in the suite is slow, and an unused marker is noise.

**Tooling**

- **A stdlib `dataclass` for settings over `pydantic-settings`** because it's one fewer dependency for a handful of strings; pydantic pays off with many typed, nested settings.
- **`requests` over `httpx`** because the suite is synchronous and `requests.Session` is the most widely known cookie-keeping client.
- **Pinning direct dependencies over a full lock file** because it's simpler; the gap (unpinned transitive deps) is noted in section 9.

### 7.2 Changing app code for testability: where the line is

Two app changes were made:

1. **A bug fix:** `PropertyRoutes.js` imported `propertyController.js`, but the file is `PropertyController.js`. On macOS (case-insensitive) it works; on Linux, where CI runs, the server wouldn't start.
2. **A testability change:** the login/register rate limit (10 per 15 minutes per IP) comes from `AUTH_RATE_LIMIT_MAX`, default 10. The auth tests make about 6 of those calls per run, so without it the second run in a row fails with 429.

The alternative to (2) was restarting the server between runs. We rejected it because a suite that only works if everyone remembers a ritual isn't repeatable.

**Where the line is: make it configurable, don't make it conditional.** A configurable limit behaves identically in production (default 10) and is something a real deployment would want anyway. What the app must *never* contain is code that exists only for tests, like `if (NODE_ENV === "test") skipAuth()`. Then the tests exercise a different code path from production, so passing proves less, and it's a security hole one misconfigured variable away.

**A worked example: `||` vs `??` vs `NaN`.** The one-line change took three attempts, each looking correct with a different bug:

```js
// Attempt 1
limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
// Attempt 2 (from code review): parse, then validate
const parsedLimit = Number(process.env.AUTH_RATE_LIMIT_MAX);
const limit = Number.isInteger(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 10;
// Attempt 3 (final): treat blank as unset, then parse and validate
const rawLimit = process.env.AUTH_RATE_LIMIT_MAX?.trim();
const parsedLimit = rawLimit ? Number(rawLimit) : NaN;
const limit = Number.isInteger(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 10;
```

| Env value | Attempt 1 | Attempt 2 | Final |
|---|---|---|---|
| unset | 10 | 10 | 10 |
| `""` | 10 | **0** (locks everyone out) | 10 |
| `"0"` | **10** (ignored) | 0 | 0 |
| `"1000"` | 1000 | 1000 | 1000 |
| `"abc"` | 10 | 10 | 10 |
| `"5.5"` | **5.5** | 10 | 10 |
| `"-1"` | **-1** | 10 | 10 |

- `||` falls back on any *falsy* value, and `0` and `NaN` are both falsy: an explicit `0` is ignored, while `-1` and `5.5` pass through.
- Swapping in `??` doesn't help: `??` falls back only on `null`/`undefined`, and `Number(undefined)` is `NaN`, so an unset variable gives `NaN`.
- Attempt 2 missed that **`Number("")` is `0`**, not `NaN`. A blank `AUTH_RATE_LIMIT_MAX=` line (which `.env.example` had at the time) gives a limit of 0, which in express-rate-limit v7+ means **block every request**.

**Why no API test catches this:** the test server always sets the limit to 1000, which all three versions handle correctly. Black-box tests only exercise the configurations they run with. The table above *is* a unit test in all but name, but nobody writes one for a one-line config parse, so in practice it's a reviewer who asks "what does this do with `0`? with `""`?". The lessons: parse, then validate, then default; list the edge cases of the *input type* (unset, empty, whitespace, zero, negative, fractional, garbage); know what the library does with the edge value.

### 7.3 A documented assumption: the authorization grids rest on a whitebox fact

**The decision.** A full cross-product of protected endpoints (6) × bad-credential kinds (5) would be 30 cases. We wrote two small grids, 10 cases:

- **one case per endpoint** (guest → 401, admin → gets past auth): *is the auth middleware attached to this route?*
- **one case per bad-token kind** (malformed, tampered, wrong secret, `alg: none`), all against `/api/auth/me`: *does the middleware reject this kind of token?*

**The assumption.** This is only equivalent to the full grid because **every protected route uses the same `requireAuth` middleware, and nothing else decides access.** That's a *whitebox* fact: it was verified by reading `PropertyRoutes.js` and `authRoutes.js`, not by the tests. It sits inside a black-box suite, which is exactly why it has to be written down.

**What the suite would *not* catch if the assumption breaks:**

1. **A route with different auth logic:** a new route guarded by an API-key check, a role check, or a different middleware. The endpoint grid would confirm a guest gets 401, but no one would send it a tampered or `alg: none` token, because the token grid only exercises `requireAuth`, through `/me`.
2. **A protected route missing from the list:** `PROTECTED_CALLS` is maintained by hand. A new admin route that nobody adds there is not tested at all. (A full cross-product built from the same hand-written list would have the same gap.)
3. **`requireAuth` becoming configurable per route** (e.g. `requireAuth({ role: "owner" })`): the two questions would no longer be independent.

**Triggers to revisit the design:**

- any change to a routes file that adds a route or changes which middleware guards one;
- introducing roles or permissions (anything beyond "logged-in admin");
- a second authentication mechanism (API keys, OAuth, service tokens);
- options or arguments passed to `requireAuth`.

When one fires: add the new route to `PROTECTED_CALLS`, and if it doesn't use plain `requireAuth`, give it its own full row of bad-token cases.

**A cheap tripwire, not built:** a test that reads the routes files and asserts that the set of routes using `requireAuth` equals the keys of `PROTECTED_CALLS`. That would catch gap 2 automatically, at the price of the suite reading the app's source. It's a deliberate step away from black-box, so it belongs in the "next" list rather than slipped in quietly.

### 7.4 The safety guard's honest limit

The guard checks the `.env` file, not the running server. If someone starts the server by hand with the real `backend/.env` on port 5001, the guard can't tell. Two things close most of that gap: the launcher script (which starts the server from the checked file), and the admin-login check (the test admin exists only in the test auth DB, so a server on the real auth DB fails the login check before any test runs). A server on the real *properties* DB but the test *auth* DB would still slip through; only the launcher prevents that combination.

### 7.5 CI: why tests run on every push, and how this workflow is built

**Why this is the whole point.** A test suite that runs only when someone remembers to run it protects only the code that person was thinking about. Regressions come from the change nobody thought was risky: a renamed import, a one-line config parse, a new route. Running the suite automatically on every push and pull request turns it from a tool into a *gate*. Every change is checked against everything the suite knows, by a machine that doesn't forget, get tired, or skip "just this once". It also answers the question that matters in code review before anyone asks it: did this change break anything we already knew how to check? The import-case bug (`propertyController.js` vs `PropertyController.js`) is the local proof: it worked on a Mac for months and would have failed on the first Linux CI run.

**What the workflow does** (`.github/workflows/api-tests.yml`):

1. Starts **MongoDB 8.0 as a service container**, a database that exists only for this job. GitHub waits for its health check before running any step.
2. Installs Node 24 and Python 3.12 (with dependency caching), then the backend (`npm ci`) and the test requirements.
3. **Generates a JWT secret and an admin password for this run**, and registers both with `::add-mask::`, so GitHub replaces them with `***` anywhere in the log.
4. Runs `python config.py` (the same safety guard as locally), starts the test server in the background, and **waits until `/api/properties` answers**. That endpoint needs the database, so a 200 means server *and* DB are ready. It gives up after 30 seconds with a clear error.
5. Seeds the admin, runs `pytest -m "not external"`, prints the server log **only if something failed**, and uploads `reports/` **always**, so a failing run keeps its evidence.

**We chose a service container over the Atlas test databases** because opening an Atlas cluster to `0.0.0.0/0` (GitHub's runner IPs change every run) would expose a real cluster to the whole internet for the sake of a test run. The container is also *more* isolated than Atlas: a fresh, empty database every run, destroyed afterwards, so the leak check starts from zero and nothing can accumulate. The trade-off: CI runs against MongoDB 8.0 in a container, while local runs use Atlas, so a version-specific difference could in principle pass in one and fail in the other.

**No repository secrets, by design.** Everything secret is generated inside the job and dies with it. Consequences:

- **Pull requests from forks run the full suite.** GitHub withholds repository secrets from fork PRs, so a secret-dependent workflow can't test outside contributions. This one can.
- **There's nothing to leak or rotate.** A per-run secret is worthless once the run ends.

**Two layers keep secrets out of the log:**

| What could leak | Who knows about it | Protection |
|---|---|---|
| The generated JWT secret and admin password | The workflow (it created them) | `::add-mask::`: GitHub masks the exact strings everywhere in the job log |
| The session JWTs the server issues during the run | Nobody in advance: they're created mid-test | The framework's own redaction (`client/redaction.py`), since GitHub can't mask a value it was never told about |

**How the "nothing prints a secret" claim was verified.** GitHub's masking can only be observed on a real run, so the check was done one level below it: a local runner read the workflow's own `run:` steps from the YAML and executed them in a sandbox containing only the files git will commit. The only substitution was pointing at the Atlas `_test` databases, since there's no Docker locally. The output was captured **unmasked**, so the test covered the framework on its own:

- a passing run, and a deliberately failing run: an authenticated request failing its assertion, an error raised while a session token was in a local variable, and a server-side 500, which also triggers the "show server log" step;
- the full step output, `server.log`, `report.html` and `junit.xml` were searched for the generated JWT secret, the generated admin password, and `eyJ` (any JWT): **0 occurrences everywhere, in both runs**;
- control: the same search found each secret exactly once in the file where the workflow deliberately stores it, so the search does find a secret when one is present.

The first real run on GitHub is still the final proof: open its log and check that each step's `env:` block shows `TEST_JWT_SECRET: ***` and `TEST_ADMIN_PASSWORD: ***`.

**The placeholder Groq key.** The backend won't start without *some* `GROQ_API_KEY`, even though only `/api/chat` uses it (FINDINGS F15). CI sets `ci-placeholder-no-external-calls`: not a secret and not a real key, and never used, because the external tests are excluded.

---

## 8. Interview questions

Each answer is drawn from what this suite actually does.

**1. "How do you handle test data cleanup?"**

> Three layers. First, every test creates its own data through factory fixtures (`make_property`), and each property is registered for deletion the moment it's created, not after, because pytest skips a fixture's teardown if setup fails before `yield`. Teardown tries every delete, even after one fails, and reports all problems together. Second, tests that expect a rejection but might hit a bug register any accidental creation *before* asserting: our negative-price test gets a 201 today, and the property is still deleted. Third, a session-wide leak check snapshots every property id before the run and compares after: it fails the run for leaked data (and deletes it so the next run starts clean) or for data a test destroyed. I tested each layer by deliberately writing tests that leak, fail mid-way, or break their own cleanup.

**2. "How do you keep tests independent?"**

> Each test gets its own data with unique values: a random alphanumeric city per property, so searching that city returns exactly that test's data. Shared objects are read-only: the admin client is logged in once per session, but no test changes its session. Tests that log out get a private client. Every login attempt uses a fresh client, so a bug that let a bad password in couldn't turn a shared guest client into an admin. I check it by running single tests in isolation and the whole suite twice in a row.

**3. "Your authorization tests have 10 cases for 6 endpoints and 5 kinds of bad credential. Why not 30?"**

> Every protected route uses the same `requireAuth` middleware, so there are two independent questions: is the middleware attached to each route, and does it reject each kind of bad token. One grid per question. The full cross-product would run identical code 20 more times. But that rests on a whitebox fact, so I documented it with the triggers that would invalidate it: a route with its own auth logic, roles, a second auth mechanism. Each endpoint case also has a control: the admin gets past auth first, so a 401 for the guest can't come from a wrong path. All the requests are harmless, so a missing auth check fails the test without deleting anything.

**4. "How do you handle known bugs?"**

> Each one is a test asserting the *correct* behaviour, marked with a strict xfail narrowed to `AssertionError`, and tied to an entry in FINDINGS.md. The suite stays green, but every bug stays visible. `strict=True` means a fix makes the run fail, so someone removes the marker and the finding. `raises=AssertionError` came from a real mistake: a broken fixture made a known-bug test report XFAIL for a completely unrelated reason, because xfail accepts any exception by default. The general rule I took from it: a suppression must be exactly as wide as the claim it makes.

**5. "How would you test something non-deterministic, like an LLM?"**

> Split it into what's deterministic and what isn't. The request validation that runs before the model call (a missing `message` gets a 400 from an early return) is fast and free, and runs every time. The model call itself gets a contract test: status 200, `reply` is non-empty text, `actionPerformed` is a boolean, the returned history ends with an assistant message. Never the wording. It's marked `external` so the fast run skips it, and because the agent can decide to add a property, any id it returns is registered for cleanup before asserting. Testing the model's *behaviour*, like whether it resists prompt injection (our F12), is LLM evaluation: many samples, thresholds, maybe a judge model. That's a different tool from a pass/fail test.

**6. "What would you do differently with 1000 tests?"**

> Run them in parallel with pytest-xdist. The unique-data design already allows that, but the leak check doesn't: a whole-database snapshot would see other workers' in-flight data as leaks. So each run would tag its data with a run id and check only its own tag, or use a fresh database per run in a container. I'd split the tests into tiers (a fast smoke set on every push, the full set before merge, external tests nightly), add schema validation of responses so shape checks aren't hand-written per test, stub the external services, and track flaky tests over time instead of retrying them. Also, a hand-maintained list like `PROTECTED_CALLS` doesn't scale: with 1000 tests I'd generate it from the routes or an OpenAPI spec.

**7. "How do you make sure tests never touch production data?"**

> The config refuses to load unless the API URL is localhost and both database names end in `_test`, and the check is inside `load_settings()`, so the fixtures, the seed script and the server launcher all get it without being able to skip it. The server is started by a launcher that passes those same checked values, because the check can only inspect a file, not a running server. And the test admin exists only in the test auth database, so a server accidentally started against the real one fails the login check before any test runs. I'm honest about the gap: a hand-started server on the real properties database and the test auth database would get past all of that, which is why the launcher matters. In CI the question doesn't arise: the job's only database is a container that exists for that run, and the workflow has no credentials for anything else.

**8. "You changed the application's code to make it testable. Isn't that cheating?"**

> One change, and it's configuration, not a test path: the login rate limit reads an environment variable with the old value as default, so production behaves identically. The line I wouldn't cross is code that only runs under test, like skipping auth when `NODE_ENV=test`: then you're testing a different app. The change also taught me something: it took three attempts to parse that one variable correctly. `||` swallowed an explicit `0`, and the reviewed fix missed that `Number("")` is `0`, which would have blocked every login. None of that was catchable by the API tests, because the test server always sets the value to 1000.

**9. "How do you know your tests actually test anything?"**

> Controls and deliberate failure. The expired-token test first proves a token with the same claims but a valid expiry *is* accepted, so the 401 can only be about expiry. The tag-filter bug is shown with a minimal pair: the same filter passes with two tags and fails with one. Every known bug was checked with `--runxfail` to confirm it fails for the documented reason, not another. I also caught one of my own tests claiming more than it proved: calling the geocoding endpoint twice and comparing coordinates doesn't prove caching, since the external service returns the same coordinates anyway. The fix was to check that the coordinates are *stored* on the property.

**10. "What's a flaky test, and how did you avoid them?"**

> A test that passes and fails on the same code. It's corrosive because people learn to rerun until green. The usual causes are shared state, leftover data, external services, timing, and environment. Here: private data per test and read-only shared clients; unique values plus cleanup plus a leak check; external calls isolated behind a marker; no sleeps, every assertion is on a completed response; a timeout on every request; and three environment checks that stop the run before any test. There's one residual risk I know of: pagination sorts only by creation time, so two properties with identical timestamps could swap between page queries. It doesn't happen with sequential creates, and the real fix is a tie-breaker in the backend's sort.

---

## 9. What I'd build next

An honest list of what a production framework has that this one doesn't yet:

- **More from CI.** Branch protection that *requires* the API-tests check before merging (today it reports, but doesn't block). A scheduled nightly job for the `external` tests, which would need a Groq key as a secret, and so wouldn't run on fork PRs. A MongoDB version matrix matching the Atlas version, to close the container-vs-Atlas gap (section 7.5).
- **Parallel execution** with `pytest-xdist`. It needs the leak check redesigned (per-run data tagging or a database per run), as in answer 6.
- **Schema / contract testing.** Validate every response against a JSON Schema or pydantic model, or against an OpenAPI spec if the backend published one. Today, response shapes are checked field by field in each test.
- **An ephemeral database for local runs too.** CI already gets a throwaway MongoDB container per run (section 7.5); local runs still use shared `_test` databases on Atlas. A local container would make them just as isolated, with no chance of pointing at real data.
- **Stubs for external services.** A fake Groq and Nominatim for deterministic tests of the error paths (model timeout, geocoder down), which the suite can't trigger today.
- **Performance checks.** Response-time budgets on key endpoints, and a small load test (k6 or Locust) that would *demonstrate* F10 (unbounded page size).
- **A routes tripwire** for the authorization assumption (section 7.3).
- **More security cases:** actually triggering the 429 on a server with a low limit, and MongoDB operator injection through JSON bodies (e.g. `{"$ne": ...}` in login fields).
- **Mutation testing of the suite itself.** Temporarily remove `requireAuth` from a route, or the `min` from `rooms`, and confirm a test fails. That's the strongest evidence the tests catch real regressions.
- **A lock file** (pip-tools or uv) pinning transitive dependencies, not just the direct ones.
- **Flaky-test tracking** across CI runs, with quarantine rules, rather than automatic retries that hide flakiness.
