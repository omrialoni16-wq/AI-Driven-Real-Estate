# Real Estate Property Listings

Fullstack app: React 19 + Vite frontend (port 5173) backed by an Express 5 + Mongoose API (port 5000) with MongoDB. An AI chat widget lets users add properties conversationally via Groq LLMs.

## Running the app

```powershell
# Terminal 1
cd backend && node server.js

# Terminal 2
cd frontend && npm run dev
```

Smoke-test and screenshot: `node .claude/skills/run-real-estate/smoke.mjs` (from repo root).

## Project layout

```
api/
  index.js                   # Vercel entry point: re-exports the Express app from backend/server.js
vercel.json                  # One Vercel project: builds frontend/, rewrites /api/* to api/index.js
backend/
  server.js                  # Express setup, connectDB, routes; exports the app, listens only outside Vercel
  src/
    config/
      db.js                   # mongoose.connect(MONGO_URI) — properties DB
      authDb.js               # mongoose.createConnection(AUTH_MONGO_URI) — separate Atlas cluster for admin users
    models/
      Property.js             # Mongoose schema (apartments collection), bound to default connection
      User.js                 # Admin schema (name, email, passwordHash), bound to authConnection
      Inquiry.js              # Guest inquiry on a property (name?, phone/email — at least one, message, status), default connection
    routes/
      PropertyRoutes.js       # All property + chat route definitions
      authRoutes.js           # /api/auth/login, /api/auth/logout, /api/auth/me, /api/auth/demo
      InquiryRoutes.js        # Guest inquiry create (public, rate-limited) + admin list/status update
    middleware/
      requireAuth.js          # Verifies JWT cookie, attaches req.user, 401 on failure
      blockDemo.js            # 403 DEMO_READ_ONLY for the demo admin on every write route
    controllers/
      PropertyController.js   # HTTP layer — validates, calls service
      chatController.js       # AI chat pipeline (Groq tool-use)
      authController.js       # login/logout/me/demoLogin handlers — bcrypt compare, JWT sign, cookie set/clear
      InquiryController.js    # Inquiry HTTP layer — honeypot check, 400/404 mapping, status validation
    service/
      PropertyService.js      # DB logic — queries, pagination, filtering (REST API)
      AgentService.js         # DB logic for agent tools — addProperty, searchPrices, searchProperties
      InquiryService.js       # DB logic for inquiries — create (field whitelist), paginated list with populated property, status update
    demo/
      demoInquiries.js        # Made-up inquiries the demo admin sees instead of real guests' details
  scripts/
    seedAdmins.js              # One-off script to upsert admin accounts into the auth cluster (not run by the server)
frontend/
  src/
    index.css                 # Tailwind v4 entrypoint + shadcn/ui theme tokens (@theme, :root, .dark)
    App.jsx                   # Root: state, fetch, filter, pagination, login/logout header, admin-gated UI
    lib/
      utils.js                 # cn() class-merge helper (clsx + tailwind-merge)
      api.js                    # Shared axios instance (baseURL: VITE_API_URL, else localhost:5000 when opened on localhost / same-origin elsewhere; withCredentials), demo read-only toast interceptor
    context/
      AuthContext.jsx          # user/isLoading state, login()/loginDemo()/logout(), GET /api/auth/me on mount
    components/
      FilterBar.jsx            # City / maxPrice / type inputs + type filter pills
      PropertyCard.jsx         # Single listing card (edit/delete buttons shown only when isAdmin) — hand-styled, does NOT use ui/ primitives (see Styling)
      PropertyCardSkeleton.jsx # Pulse-animated placeholder shown in the grid while properties are loading
      AddPropertyForm.jsx      # Modal form for manual add
      EditPropertyForm.jsx     # Modal form for editing
      LoginForm.jsx             # Email/password form used inside the login Dialog
      AddAdminForm.jsx          # Name/email/password form, POST /api/auth/register (admin-only)
      InquiryForm.jsx           # Guest "צור קשר" form → POST /api/properties/:id/inquiries (includes hidden honeypot field)
      InquiriesPanel.jsx        # Admin inquiries list (status filter, per-inquiry status select, pagination) — presentational
      Pagination.jsx           # Prev / Next controls
      AIChat.jsx               # Chat widget → POST /api/chat (admin-only)
      theme-provider.jsx       # Light/dark context, persists to localStorage
      ThemeToggle.jsx          # Sun/moon button, toggles ThemeProvider theme
      ui/                      # shadcn/ui primitives (button, card, dialog, input, label, select, textarea, badge, dropdown-menu, sonner)
```

## Architecture

**Backend pattern:** Route → Controller → Service → Mongoose. Controllers handle HTTP concerns; services own all DB logic. Keep them separate.

**Frontend pattern:** All data lives in `App.jsx` state. Child components receive data and callbacks as props — they never fetch directly. `fetchProperties(page, filters)` is the single re-fetch function called after every mutation.

**Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`, no `tailwind.config.js`) + shadcn/ui (`new-york` style, components in `src/components/ui/`). Import alias `@/*` → `src/*` (configured in `vite.config.js` and `jsconfig.json`). Theme tokens live in `src/index.css` — a warm off-white/near-black monochrome palette (`oklch` values with a slight warm tint, not pure gray) with `--radius: 0.9rem` for a rounder, softer look. Dark mode is a `.dark` class on `<html>` toggled by `ThemeProvider` (`main.jsx` wraps `<App />`) and persisted to `localStorage` under `real-estate-theme`. **Exception:** `PropertyCard.jsx` was hand-restyled with raw `article`/`div`/`button` elements and inline Tailwind classes instead of the `ui/` `Card`/`Badge`/`Button` primitives — it's the one component that intentionally diverges from the shadcn-primitives pattern used everywhere else.

## Authentication

Admin-only JWT auth, guest browsing stays public. Guests can view/filter/paginate listings; only logged-in admins get CRUD (add/edit/delete) and the AI Assistant.

- **Storage:** admin accounts live in a **separate MongoDB Atlas cluster** from the property data, connected via `authDb.js` (`mongoose.createConnection`, not the default singleton). Keeps credentials isolated even if the properties DB connection string ever leaks.
- **Token:** `POST /api/auth/login` (`authController.js`) checks `bcryptjs.compare()` against `User.passwordHash`, signs a JWT (`jsonwebtoken`, `{ userId, name, email }`, 3h expiry) with `JWT_SECRET`, and sets it as an **httpOnly cookie** (`sameSite: "lax"`) — never returned in the JSON body, so frontend JS can't read or leak it.
- **Session check:** frontend can't read an httpOnly cookie, so `AuthContext.jsx` calls `GET /api/auth/me` on mount to determine login state; `requireAuth.js` middleware verifies the cookie on every protected route and attaches `req.user`.
- **CORS:** since the cookie must cross the `5173` → `5000` origin boundary, `server.js` uses a dynamic origin-validation function (allowing both `http://localhost:5173` and `http://127.0.0.1:5173` — a static origin string would only ever match one of them and silently break the other) with `credentials: true`; the frontend's shared `lib/api.js` axios instance sets `withCredentials: true` on every request. Both sides are required or the cookie won't be sent/accepted.
- **Protected routes:** `requireAuth` wraps `POST/PUT/DELETE /api/properties`, all of `/api/chat` (the AI Assistant is admin-only, not just its `addProperty` tool), `POST /api/auth/register`, and `GET/PATCH /api/inquiries`. `GET /api/properties`, `GET /api/search` and `POST /api/properties/:id/inquiries` stay open.
- **Admin accounts:** no *public* registration, but any logged-in admin can create another via the "הוספת מנהל" (Add Admin) item in the user-name dropdown in the header (`AddAdminForm.jsx` → `POST /api/auth/register`, `requireAuth`-gated). `backend/scripts/seedAdmins.js` still exists as a manual bootstrap tool for creating the very first admin on a fresh DB (chicken-and-egg: the in-app flow needs an existing admin to be logged in) — fill in its `ADMINS` array and run `node scripts/seedAdmins.js`, then clear the array back out since the file isn't gitignored.
- **Frontend gating:** `App.jsx` reads `user` from `useAuth()` to show a "התחברות" (login) button vs. a dropdown with the admin's name (Add Admin / logout) in the header, and conditionally renders the add-property FAB, `AIChat`, and each `PropertyCard`'s edit/delete footer (`isAdmin` prop) only when logged in.

Required env vars in `backend/.env`: `AUTH_MONGO_URI`, `JWT_SECRET` (in addition to `MONGO_URI`, `GROQ_API_KEY`).

## Demo admin

A "כניסה כאדמין דמו" button (header and login dialog) lets portfolio visitors see the full admin UI without credentials. It is read-only.

- **Session:** `POST /api/auth/demo` (`demoLogin`) signs a 1h JWT with `{ userId: null, name, email, isDemo: true, demoId }`. There is no user row; `me` answers from the JWT. Rate-limited separately from login (`DEMO_RATE_LIMIT_MAX`, 20 per 15 min). `DEMO_ENABLED=false` removes the route.
- **Writes:** `blockDemo` (after `requireAuth`) answers `403 { code: "DEMO_READ_ONLY" }` on property POST/PUT/DELETE, inquiry PATCH and register. **Any new write route needs `blockDemo` too.** The frontend's axios interceptor in `lib/api.js` shows one toast for that code; handlers check `isDemoReadOnly(error)` to skip their own `alert`/error.
- **Inquiries:** `getInquiries` returns `listDemoInquiries` (fixed fake guests attached to real properties, same shape and paging as `listInquiries`), so real contact details never reach the demo.
- **Chat:** one message per `demoId` (a `demo_chats` document per used session, `models/DemoChat.js`, TTL 1h — in MongoDB because Vercel instances don't share memory; the message is given back if the pipeline errors), plus a per-IP limit for demo users only (`DEMO_CHAT_RATE_LIMIT_MAX`, 5/hour). In demo mode the client's `history` is ignored, `addProperty` returns `demo_blocked` without saving, the loop is capped at 4 iterations, and `DEMO_PROMPT_ADDENDUM` tells the model not to ask follow-ups. `AIChat.jsx` shows a demo welcome listing the capabilities, example-question chips, and locks the input after the message.
- **UI:** a sticky amber banner ("מצב דמו · קריאה בלבד") with an exit button while `user.isDemo`.

## API

Base URL: `http://localhost:5000`

| Method | Path | Query / Body |
|---|---|---|
| GET | `/api/properties` | `page`, `limit` (default 21), `city`, `maxPrice`, `type` |
| POST | `/api/properties` | `{ img, price, street, city, type, rooms, floor, size, tags, description }` |
| PUT | `/api/properties/:id` | partial property fields |
| DELETE | `/api/properties/:id` | — |
| POST | `/api/chat` | `{ message, history[] }` |
| GET | `/api/search` | `city`, `type`, `minPrice`, `maxPrice`, `rooms`, `floor`, `minSize`, `maxSize`, `tags[]` |
| POST | `/api/auth/login` | `{ email, password }` — sets httpOnly JWT cookie |
| POST | `/api/auth/demo` | — starts a read-only demo admin session (1h cookie) |
| POST | `/api/auth/logout` | — clears the cookie |
| GET | `/api/auth/me` | — (requireAuth) returns `{ user }` for the current session |
| POST | `/api/auth/register` | (requireAuth) `{ name, email, password }` — creates another admin |
| POST | `/api/properties/:id/inquiries` | `{ name?, phone?, email?, message }` — public, phone or email required, 5 per 15 min per IP (`INQUIRY_RATE_LIMIT_MAX`) |
| GET | `/api/inquiries` | (requireAuth) `status` (`new`/`in_progress`/`closed`), `page`, `limit` (default 20) |
| PATCH | `/api/inquiries/:id` | (requireAuth) `{ status }` |

Response shape for GET `/api/properties`:
```json
{ "success": true, "properties": [...], "totalProperties": 1000, "totalPages": 48, "currentPage": 1 }
```

## Property schema

```js
{ img, price, street, city, type, info1, rooms, floor, size, tags: [String], description }
// + createdAt / updatedAt (timestamps: true)
// + embedding (vector, excluded from /api/search responses via .select("-embedding"))
```

`type` accepted values in the AI chat tool (Hebrew, matching real DB values): `"דירה"`, `"בית פרטי/ קוטג'"`, `"גג/ פנטהאוז"`, `"דירת גן"`, `"דופלקס"`, `"סטודיו/ לופט"`. The same list is shared by the frontend (`frontend/src/lib/propertyTypes.js`) and used in `FilterBar`, `AddPropertyForm`, and `EditPropertyForm`.

## Inquiries

Guests leave an inquiry from a property card ("צור קשר"); admins see all of them under "פניות" in the header dropdown.

- **Contact rule:** guests have no account, so `Inquiry.js` has a `pre("validate")` hook requiring `phone` or `email` (name is optional).
- **Field whitelist:** `createInquiry` copies only `name, phone, email, message` from the body, so a guest can't set `status`.
- **Spam:** `inquiryLimiter` (express-rate-limit) on the create route, plus a honeypot — `InquiryForm` renders a visually hidden `website` input; if it's filled, the controller answers 201 without saving.
- **Retention:** closing an inquiry sets `closedAt`; a TTL index on it deletes the document `CLOSED_INQUIRY_RETENTION_DAYS` (180) days later. Reopening `$unset`s `closedAt`, and open inquiries never expire. `InquiryForm` shows guests a privacy notice with the same number — keep its local constant in sync with the model. Changing the number on an existing DB needs a `collMod` (Mongoose won't update an existing TTL index).
- **Property deletion** cascades: `deleteProperty` in `PropertyService.js` also deletes that property's inquiries.

## AI chat pipeline

`chatController.js` uses the OpenAI SDK pointed at Groq (`baseURL: "https://api.groq.com/openai/v1"`).

Unified agentic loop (`openai/gpt-oss-20b`, up to 8 iterations) with three tools:

- `addProperty` — collects required fields (city, street, price, rooms, size, floor, type), then calls `agentAddProperty` in `AgentService.js` which saves to DB with a default `img` and generated Hebrew `description`.
- `searchPrices` — calls `agentSearchPrices` to return avg/min/max price statistics, optionally filtered by city, type, and rooms.
- `searchProperties` — calls `agentSearchProperties` which wraps `filterPropertiesService` and caps results at 5 for LLM consumption.

All tool DB logic lives in `AgentService.js`. `chatController.js` only handles LLM orchestration and tool routing.

Conversational history is passed in as `history[]` and returned as `updatedHistory` so the client maintains context across turns.

Required env var: `GROQ_API_KEY` in `backend/.env`.

## Environment

`backend/.env` (not committed):
```
MONGO_URI=<connection string>          # properties cluster
GROQ_API_KEY=<groq key>
AUTH_MONGO_URI=<connection string>     # separate cluster for admin users
JWT_SECRET=<long random string>
```

## Pagination behaviour

- `fetchPropertiesWithPagination` caps results at 1000 total (`maxProperties = 1000`).
- `adjustedLimit = Math.min(limit, 1000 - skip)` prevents over-fetching near the cap.
- `price` filter uses MongoDB aggregation (`$addFields` + `$toDouble`) because the field type is `Number` but `maxPrice` comparison requires explicit casting.

## Key constraints

- Both servers must run simultaneously — the frontend has no mock/offline mode.
- All backend files use ESM (`"type": "module"` in both `package.json`s) — use `import`/`export`, not `require`.
- The app is fully Hebrew/RTL: `index.html` sets `lang="he" dir="rtl"`, all UI copy is Hebrew, and the AI chat assistant is instructed (via `SYSTEM_PROMPT` in `chatController.js`) to always reply in Hebrew regardless of the input language. Keep new user-facing strings in Hebrew; code identifiers/comments stay in English.
- If `frontend/` files were bulk-replaced/re-imported from elsewhere (e.g. dragging in a new export), check whether `frontend/node_modules/` survived the operation before assuming `npm run dev` is broken code — a missing `node_modules` (silently excluded from most file exports/uploads) looks like a mysterious dev-server failure but is fixed by a plain `npm install`.
