# Findings

**15 findings: 6 crashes, 4 validation gaps, 5 design issues. 5 are medium severity, 10 are low. None allows access without logging in.**

| Group | Count | Findings | Covered by a test |
|---|---|---|---|
| Crashes: bad input causes a 500 | 6 | F1–F6 | 6 of 6 |
| Missing validation: bad input is accepted or ignored | 4 | F8–F11 | 3 of 4 (F10 needs a large dataset) |
| Design issues | 5 | F7, F12–F15 | 2 of 5 (F12 is non-deterministic, F14 is manual, F15 is about startup) |
| **Total** | **15** | | **11 findings, 15 test cases (all strict xfail)** |

Weaknesses in the Real Estate API, found while building this test suite by reading the code and then confirming each one against a running server.

**How findings relate to tests.** Each finding with a test is covered by a test that asserts the *correct* behaviour and is marked `@known_bug("Fn", ...)`, a strict xfail (see `findings.py`). Today those tests report `XFAIL`: they fail, for the documented reason. The day a bug is fixed, its test passes, `strict=True` turns that into a failed run, and the marker (and this entry) must be removed. `known_bug` refuses any id that has no section in this file, so the two can't drift apart.

**Reproducing.** Commands assume the test server is running (`python scripts/run_test_server.py`, port 5001). For admin-only requests, log in once and reuse the cookie:

```bash
curl -s -c jar.txt -H 'Content-Type: application/json' \
  -d '{"email":"<TEST_ADMIN_EMAIL>","password":"<TEST_ADMIN_PASSWORD>"}' http://localhost:5001/api/auth/login
```

## Summary

| ID | Finding | Severity | Test |
|---|---|---|---|
| **Crashes: bad input causes a 500** | | | |
| [F1](#f1-an-id-that-isnt-an-objectid-causes-a-500) | An id that isn't an ObjectId causes a 500 | Low | ✔ ×3 |
| [F2](#f2-an-invalid-value-in-an-update-causes-a-500) | An invalid value in an update causes a 500 | Low | ✔ |
| [F3](#f3-the-city-filter-treats-user-text-as-a-regular-expression) | The city filter treats user text as a regular expression | **Medium** | ✔ ×3 |
| [F4](#f4-a-non-numeric-minprice-causes-a-500) | A non-numeric `minPrice` causes a 500 | Low | ✔ |
| [F5](#f5-a-chat-history-that-isnt-a-list-causes-a-500) | A chat `history` that isn't a list causes a 500 | Low | ✔ |
| [F6](#f6-a-request-from-a-disallowed-origin-causes-a-500) | A request from a disallowed origin causes a 500 | Low | ✔ |
| **Missing validation: bad input is accepted or ignored** | | | |
| [F8](#f8-a-negative-price-is-accepted) | A negative price is accepted | **Medium** | ✔ |
| [F9](#f9-any-text-is-accepted-as-a-property-type) | Any text is accepted as a property type | Low | ✔ |
| [F10](#f10-the-page-size-has-no-upper-limit) | The page size has no upper limit | **Medium** | code review |
| [F11](#f11-a-single-tag-filter-is-silently-ignored) | A single tag filter is silently ignored | Low | ✔ |
| **Design issues** | | | |
| [F7](#f7-some-errors-come-back-as-html-pages-with-stack-traces) | Some errors come back as HTML pages with stack traces | Low | ✔ |
| [F12](#f12-the-chat-client-controls-the-whole-conversation-history) | The chat client controls the whole conversation history | **Medium** | code review |
| [F13](#f13-logout-doesnt-revoke-the-session-token) | Logout doesn't revoke the session token | **Medium** | ✔ |
| [F14](#f14-error-responses-expose-internal-error-messages) | Error responses expose internal error messages | Low | manual |
| [F15](#f15-the-whole-server-refuses-to-start-without-a-groq-api-key) | The whole server refuses to start without a Groq API key | Low | CI setup |

**Severity, in plain terms.** *Medium*: misuse can cause real harm (bad data shown to users, the server overloaded, access that outlives a logout). *Low*: the wrong status code, a confusing error, or information that helps an attacker a little. Nothing found allows access without logging in: every admin endpoint rejected every unauthenticated or forged request (`tests/test_authorization.py`).

A 500 is a finding even when nothing breaks. It tells the client "the server failed" when the client sent bad input, it hides real server failures among input mistakes in the logs, and it usually means the code never considered that input.

---

## Crashes: bad input causes a 500

### F1: An id that isn't an ObjectId causes a 500

- **Input:** a malformed id in the URL, e.g. `PUT /api/properties/not-an-id`. Same for `DELETE` and `GET .../location`.
- **What happens:** `500` with `"error": "Cast to ObjectId failed for value \"not-an-id\"..."`.
- **What should happen:** `400`, "invalid id". (A *well-formed* id that doesn't exist correctly gets `404`.)
- **Where:** Mongoose throws a `CastError` before querying; each controller's catch block answers 500: [PropertyController.js:63](../backend/src/controllers/PropertyController.js#L63), [:83](../backend/src/controllers/PropertyController.js#L83), [:108](../backend/src/controllers/PropertyController.js#L108).
- **Severity:** Low. Wrong status code and an internal message leaked; no data is affected.
- **Reproduce:** `curl -s -b jar.txt -X DELETE http://localhost:5001/api/properties/not-an-id`
- **Test:** `test_validation.py::test_a_malformed_id_is_rejected_with_400` (update, delete, location).

### F2: An invalid value in an update causes a 500

- **Input:** `PUT /api/properties/<id>` with `{"rooms": -1}`.
- **What happens:** `500` with `"error": "Validation failed: rooms: ... less than minimum"`. The value is correctly **not** saved.
- **What should happen:** `400`, like the same value on create.
- **Where:** `runValidators: true` rejects it, but the catch block in [PropertyController.js:61-66](../backend/src/controllers/PropertyController.js#L61-L66) treats every error as a server error.
- **Severity:** Low. Data is protected; the client is told the server failed instead of what it did wrong.
- **Reproduce:** `curl -s -b jar.txt -X PUT -H 'Content-Type: application/json' -d '{"rooms":-1}' http://localhost:5001/api/properties/<id>`
- **Test:** `test_validation.py::test_updating_a_property_with_an_invalid_value_is_rejected_with_400_and_not_saved`

### F3: The city filter treats user text as a regular expression

- **Input:** the `city` query parameter on `GET /api/properties` and `GET /api/search`.
- **What happens:** the text is compiled with `new RegExp(city)`, so it's interpreted as a pattern, not as text:
  - `city=(` is an invalid pattern: `500` (`"Invalid regular expression: /(/"`).
  - `city=.` is a wildcard: it matches **every** city.
  - A crafted pattern (e.g. nested repetition like `(a+)+$`) can make the regex engine run for a very long time on long city names: the "ReDoS" class of bug. *Not tested; inferred from the code.*
- **What should happen:** the text is matched literally (escape it before building the regex, or use a plain case-insensitive comparison), and an empty or odd value is never a 500.
- **Where:** [PropertyService.js:14](../backend/src/service/PropertyService.js#L14) and [:135](../backend/src/service/PropertyService.js#L135), in two separate functions, so both need the fix.
- **Severity:** Medium. Public, unauthenticated input reaches a regex engine: wrong results today, and a possible way to tie up the server.
- **Reproduce:** `curl -s 'http://localhost:5001/api/search?city=('` (500) and `curl -s 'http://localhost:5001/api/search?city=.'` (every property).
- **Tests:** `test_search_and_filtering.py::test_city_filter_with_an_unbalanced_parenthesis_is_not_a_server_error` (both endpoints) and `::test_city_filter_with_a_dot_matches_only_cities_containing_a_literal_dot`. The suite's own test data uses strictly alphanumeric city names because of this finding.

### F4: A non-numeric `minPrice` causes a 500

- **Input:** `GET /api/search?minPrice=abc` (also `maxPrice`, `minSize`, `maxSize` on the same endpoint).
- **What happens:** `Number("abc")` is `NaN`, the `NaN` goes into the Mongo query, and the cast error is a `500`. (`GET /api/properties?maxPrice=abc` is fine: that code path drops the filter.)
- **What should happen:** `400`, "minPrice must be a number".
- **Where:** [PropertyService.js:145](../backend/src/service/PropertyService.js#L145) and the lines after it.
- **Severity:** Low. Public endpoint, wrong status code, no data affected.
- **Reproduce:** `curl -s 'http://localhost:5001/api/search?minPrice=abc'`
- **Test:** `test_search_and_filtering.py::test_search_with_a_non_numeric_min_price_is_rejected_with_400`

### F5: A chat `history` that isn't a list causes a 500

- **Input:** `POST /api/chat` with `{"message": "hi", "history": {}}`.
- **What happens:** `...history` throws a `TypeError` (an object isn't iterable), caught as a `500`. A *string* history would instead be spread into single characters and sent to the model.
- **What should happen:** `400`, "history must be an array of messages".
- **Where:** [chatController.js:251](../backend/src/controllers/chatController.js#L251). `history` is never validated. See also F12.
- **Severity:** Low. Admin-only endpoint, wrong status code.
- **Reproduce:** `curl -s -b jar.txt -H 'Content-Type: application/json' -d '{"message":"hi","history":{}}' http://localhost:5001/api/chat`
- **Test:** `test_validation.py::test_chat_with_a_history_that_is_not_a_list_is_rejected_with_400`

### F6: A request from a disallowed origin causes a 500

- **Input:** any request with an `Origin` header that isn't in the allow-list, e.g. `Origin: https://evil.example`.
- **What happens:** the CORS origin check throws an `Error`, and Express's default error handler turns it into a `500` HTML page with a stack trace (see F7).
- **What should happen:** a normal refusal: call the CORS callback with `false` (the response simply lacks `Access-Control-Allow-Origin`, and the browser blocks it), or answer `403`.
- **Where:** [server.js:33](../backend/server.js#L33).
- **Severity:** Low. Browsers still block the cross-origin read, so this isn't a security hole, but every such request is logged as a server error.
- **Reproduce:** `curl -s -H 'Origin: https://evil.example' 'http://localhost:5001/api/properties?limit=1'`
- **Test:** `test_validation.py::test_request_from_a_disallowed_origin_is_not_a_server_error`

## Missing validation: bad input is accepted or ignored

### F8: A negative price is accepted

- **Input:** `POST /api/properties` with `"price": -1000000`.
- **What happens:** `201`; the listing is saved and shown publicly with a negative price.
- **What should happen:** `400`. The schema already has minimums for `rooms`, `size` and `floor`, but not for `price`.
- **Where:** [Property.js:6](../backend/src/models/Property.js#L6), no `min` on `price`.
- **Severity:** Medium. Nonsense data reaches the public listing page and skews price statistics (the chat's `searchPrices` averages include it).
- **Reproduce:** `curl -s -b jar.txt -H 'Content-Type: application/json' -d '{"img":"x","price":-1,"street":"s","city":"c","type":"דירה","rooms":1,"floor":1,"size":1}' http://localhost:5001/api/properties` (then delete the created id)
- **Test:** `test_validation.py::test_creating_a_property_with_one_invalid_field_is_rejected_with_400_naming_that_field[negative price]`

### F9: Any text is accepted as a property type

- **Input:** `POST /api/properties` with `"type": "Castle"`.
- **What happens:** `201`. The property then matches none of the type filters in the UI, so it can't be found by type.
- **What should happen:** `400`. The AI chat's `addProperty` tool already restricts `type` to the six Hebrew values ([chatController.js:133](../backend/src/controllers/chatController.js#L133)); the REST endpoint doesn't.
- **Where:** [Property.js:9](../backend/src/models/Property.js#L9), no `enum`.
- **Severity:** Low. Admin-only input; causes listings that are hard to find, not a security problem.
- **Reproduce:** as F8 with `"type":"Castle"`.
- **Test:** `test_validation.py::test_creating_a_property_with_one_invalid_field_is_rejected_with_400_naming_that_field[unknown property type]`

### F10: The page size has no upper limit

- **Input:** `GET /api/properties?limit=1000000`.
- **What happens:** every matching property is returned in one response. The 5000 cap applies only to the reported *count*, not to the query.
- **What should happen:** `limit` capped (e.g. at 100), or rejected above the cap.
- **Where:** [PropertyService.js:22](../backend/src/service/PropertyService.js#L22), `Math.max(1, ...)` with no `Math.min`.
- **Severity:** Medium. Anyone, without logging in, can make the server load and serialize the whole collection in one request: an easy way to slow it down, and to scrape all the data at once.
- **Test:** none. It can't be observed on the small test database; a test would need thousands of properties. Found by code review.

### F11: A single tag filter is silently ignored

- **Input:** `GET /api/search?tags=balcony` (one tag).
- **What happens:** the filter is ignored and all properties are returned. Express 5 parses a single `tags=x` as a string, and the service only applies the filter when `Array.isArray(tags)`. Two or more tags (`?tags=a&tags=b`) arrive as an array and work.
- **What should happen:** a single tag filters like several do (accept a string and wrap it in an array).
- **Where:** [PropertyService.js:163](../backend/src/service/PropertyService.js#L163).
- **Severity:** Low. Wrong search results, with no error to tell the user the filter was dropped.
- **Reproduce:** compare `curl -s 'http://localhost:5001/api/search?tags=balcony'` with `...?tags=balcony&tags=api-test`.
- **Test:** `test_search_and_filtering.py::test_search_by_tags_keeps_only_properties_that_have_every_tag`, where the one-tag case is the xfail and the two-tag case passes. The minimal pair shows that only the query encoding differs.

## Design issues

### F7: Some errors come back as HTML pages with stack traces

- **Input:** malformed JSON (`{"city": "Haifa",`), a body over 10kb, or a disallowed origin (F6).
- **What happens:** these errors never reach a controller. Express's default handler answers with an **HTML** page. When `NODE_ENV` isn't `production` it includes the full stack trace, with absolute file paths on the server (`/Users/.../backend/node_modules/body-parser/...`). Status codes are correct (400, 413).
- **What should happen:** a final JSON error handler (`app.use((err, req, res, next) => ...)`) so every error has the same JSON shape and never includes a stack trace.
- **Where:** [server.js](../backend/server.js), no error-handling middleware.
- **Severity:** Low. Clients must handle two error formats. The stack traces disappear with `NODE_ENV=production`, but only if every deployment remembers to set it.
- **Reproduce:** `curl -s -b jar.txt -H 'Content-Type: application/json' -d '{bad json' http://localhost:5001/api/properties`
- **Test:** `test_validation.py::test_malformed_json_is_rejected_with_a_400_json_error`. The oversized-body case is covered for its status code by `test_creating_a_property_with_an_oversized_body_is_rejected_with_413`.

### F12: The chat client controls the whole conversation history

- **Input:** `POST /api/chat` with a `history` containing `{"role": "system", "content": "..."}` or fabricated `tool` results.
- **What happens:** the client-supplied history is inserted into the model's context unchanged, including roles the client should never be able to write. A client can override the system prompt's rules or feed the agent fake tool results.
- **What should happen:** keep the history on the server, or at minimum accept only `user`/`assistant` messages from the client and drop everything else.
- **Where:** [chatController.js:251](../backend/src/controllers/chatController.js#L251).
- **Severity:** Medium in principle, reduced here because only logged-in admins can reach `/api/chat`. It would become serious if the chat were ever opened to guests.
- **Test:** none. Proving it means showing that the model *obeyed* an injected instruction, which is non-deterministic and costs a model call. Found by code review.

### F13: Logout doesn't revoke the session token

- **Input:** a session token copied before logout, sent again after logout.
- **What happens:** `GET /api/auth/me` answers `200` with the admin's details.
- **What should happen:** `401`. A logged-out session should be dead everywhere.
- **Where:** [authController.js:79-82](../backend/src/controllers/authController.js#L79-L82) only calls `res.clearCookie`; [requireAuth.js:11](../backend/src/middleware/requireAuth.js#L11) only checks the signature and expiry, so the server has no record that the token was logged out.
- **Severity:** Medium. A stolen token (e.g. from a shared computer or a leaked log) keeps admin access for up to 3 hours after the admin logs out; logout gives a false sense of security.
- **Reproduce:**
  ```bash
  cp jar.txt stolen.txt                                                    # an attacker's copy of the cookie
  curl -s -b jar.txt -c jar.txt -X POST http://localhost:5001/api/auth/logout
  curl -s -b stolen.txt http://localhost:5001/api/auth/me                  # 200, not 401
  ```
- **Fix options (not applied):** a server-side denylist of logged-out token ids (`jti` claim) checked in `requireAuth`, or a `tokenVersion` on the user that logout increments. Both give up part of what makes a JWT stateless in exchange for a real logout. A shorter token lifetime narrows the window without closing it.
- **Test:** `test_auth.py::test_token_captured_before_logout_is_rejected_after_logout`

### F14: Error responses expose internal error messages

- **Input:** any request that fails in the property controllers (e.g. F1, F2, or an invalid create).
- **What happens:** the raw `error.message` is returned, e.g. `"apartments validation failed: ..."` or `"Cast to ObjectId failed ... at path \"_id\" for model \"apartments\""`, revealing collection names, the ODM in use, and internal field paths.
- **What should happen:** a message written for the client ("rooms must be 0 or more"), with the internal detail only in the server log.
- **Where:** `error: error.message` in [PropertyController.js](../backend/src/controllers/PropertyController.js) (lines 31, 45, 65, 83, 111).
- **Severity:** Low. It makes the next attack slightly easier; nothing is exposed directly.
- **Test:** none of its own. The bodies are visible in the F1/F2 xfail output (`pytest --runxfail`). A strict "no internals" test would conflict with the useful part of the current messages (they name the invalid field), so it's left to the fix.

### F15: The whole server refuses to start without a Groq API key

- **Input:** starting the backend with `GROQ_API_KEY` unset or empty.
- **What happens:** the server crashes at startup with `Missing credentials. Please pass an apiKey...`. The OpenAI SDK client is created when `chatController.js` is imported, and `PropertyRoutes.js` imports it, so **every** endpoint goes down, including login and the public listing, not just the AI chat.
- **What should happen:** an optional external integration must not be able to take down authentication and public listings. The rest of the API runs without the key, and only `/api/chat` answers with an error (e.g. `503`, "AI assistant not configured").
- **Fix direction (not implemented):** create the Groq client lazily, on the first chat request, instead of at import time. A missing key then becomes a chat-only error.
- **Where:** [chatController.js:8-11](../backend/src/controllers/chatController.js#L8-L11), imported at [PropertyRoutes.js:11](../backend/src/routes/PropertyRoutes.js#L11).
- **Severity:** Low. No data or access is at risk, but a missing or revoked key for one optional feature takes down login and the public site.
- **Reproduce:** start the backend with `GROQ_API_KEY=` (empty) and watch it exit.
- **Test:** none. It's about process startup, which a black-box HTTP suite can't observe. Found while building CI: the workflow passes a non-secret placeholder key (`ci-placeholder-no-external-calls`) because the fast run never calls Groq.

