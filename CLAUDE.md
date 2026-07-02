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
backend/
  server.js                  # Entry point — Express setup, connectDB, routes
  src/
    config/
      db.js                   # mongoose.connect(MONGO_URI) — properties DB
      authDb.js               # mongoose.createConnection(AUTH_MONGO_URI) — separate Atlas cluster for admin users
    models/
      Property.js             # Mongoose schema (apartments collection), bound to default connection
      User.js                 # Admin schema (name, email, passwordHash), bound to authConnection
    routes/
      PropertyRoutes.js       # All property + chat route definitions
      authRoutes.js           # /api/auth/login, /api/auth/logout, /api/auth/me
    middleware/
      requireAuth.js          # Verifies JWT cookie, attaches req.user, 401 on failure
    controllers/
      PropertyController.js   # HTTP layer — validates, calls service
      chatController.js       # AI chat pipeline (Groq tool-use)
      authController.js       # login/logout/me handlers — bcrypt compare, JWT sign, cookie set/clear
    service/
      PropertyService.js      # DB logic — queries, pagination, filtering (REST API)
      AgentService.js         # DB logic for agent tools — addProperty, searchPrices, searchProperties
  scripts/
    seedAdmins.js              # One-off script to upsert admin accounts into the auth cluster (not run by the server)
frontend/
  src/
    index.css                 # Tailwind v4 entrypoint + shadcn/ui theme tokens (@theme, :root, .dark)
    App.jsx                   # Root: state, fetch, filter, pagination, login/logout header, admin-gated UI
    lib/
      utils.js                 # cn() class-merge helper (clsx + tailwind-merge)
      api.js                    # Shared axios instance (baseURL + withCredentials: true for the auth cookie)
    context/
      AuthContext.jsx          # user/isLoading state, login()/logout(), GET /api/auth/me on mount
    components/
      FilterBar.jsx            # City / maxPrice / type inputs
      PropertyCard.jsx         # Single listing card (edit/delete buttons shown only when isAdmin)
      AddPropertyForm.jsx      # Modal form for manual add
      EditPropertyForm.jsx     # Modal form for editing
      LoginForm.jsx             # Email/password form used inside the login Dialog
      AddAdminForm.jsx          # Name/email/password form, POST /api/auth/register (admin-only)
      Pagination.jsx           # Prev / Next controls
      AIChat.jsx               # Chat widget → POST /api/chat (admin-only)
      theme-provider.jsx       # Light/dark context, persists to localStorage
      ThemeToggle.jsx          # Sun/moon button, toggles ThemeProvider theme
      ui/                      # shadcn/ui primitives (button, card, dialog, input, label, select, textarea, badge, dropdown-menu)
```

## Architecture

**Backend pattern:** Route → Controller → Service → Mongoose. Controllers handle HTTP concerns; services own all DB logic. Keep them separate.

**Frontend pattern:** All data lives in `App.jsx` state. Child components receive data and callbacks as props — they never fetch directly. `fetchProperties(page, filters)` is the single re-fetch function called after every mutation.

**Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`, no `tailwind.config.js`) + shadcn/ui (`new-york` style, components in `src/components/ui/`). Import alias `@/*` → `src/*` (configured in `vite.config.js` and `jsconfig.json`). Theme tokens live in `src/index.css`; dark mode is a `.dark` class on `<html>` toggled by `ThemeProvider` (`main.jsx` wraps `<App />`) and persisted to `localStorage` under `real-estate-theme`.

## Authentication

Admin-only JWT auth, guest browsing stays public. Guests can view/filter/paginate listings; only logged-in admins get CRUD (add/edit/delete) and the AI Assistant.

- **Storage:** admin accounts live in a **separate MongoDB Atlas cluster** from the property data, connected via `authDb.js` (`mongoose.createConnection`, not the default singleton). Keeps credentials isolated even if the properties DB connection string ever leaks.
- **Token:** `POST /api/auth/login` (`authController.js`) checks `bcryptjs.compare()` against `User.passwordHash`, signs a JWT (`jsonwebtoken`, `{ userId, name, email }`, 7d expiry) with `JWT_SECRET`, and sets it as an **httpOnly cookie** (`sameSite: "lax"`) — never returned in the JSON body, so frontend JS can't read or leak it.
- **Session check:** frontend can't read an httpOnly cookie, so `AuthContext.jsx` calls `GET /api/auth/me` on mount to determine login state; `requireAuth.js` middleware verifies the cookie on every protected route and attaches `req.user`.
- **CORS:** since the cookie must cross the `5173` → `5000` origin boundary, `server.js` uses a dynamic origin-validation function (allowing both `http://localhost:5173` and `http://127.0.0.1:5173` — a static origin string would only ever match one of them and silently break the other) with `credentials: true`; the frontend's shared `lib/api.js` axios instance sets `withCredentials: true` on every request. Both sides are required or the cookie won't be sent/accepted.
- **Protected routes:** `requireAuth` wraps `POST/PUT/DELETE /api/properties`, all of `/api/chat` (the AI Assistant is admin-only, not just its `addProperty` tool), and `POST /api/auth/register`. `GET /api/properties` and `GET /api/search` stay open.
- **Admin accounts:** no *public* registration, but any logged-in admin can create another via the "הוספת מנהל" (Add Admin) item in the user-name dropdown in the header (`AddAdminForm.jsx` → `POST /api/auth/register`, `requireAuth`-gated). `backend/scripts/seedAdmins.js` still exists as a manual bootstrap tool for creating the very first admin on a fresh DB (chicken-and-egg: the in-app flow needs an existing admin to be logged in) — fill in its `ADMINS` array and run `node scripts/seedAdmins.js`, then clear the array back out since the file isn't gitignored.
- **Frontend gating:** `App.jsx` reads `user` from `useAuth()` to show a "התחברות" (login) button vs. a dropdown with the admin's name (Add Admin / logout) in the header, and conditionally renders the add-property FAB, `AIChat`, and each `PropertyCard`'s edit/delete footer (`isAdmin` prop) only when logged in.

Required env vars in `backend/.env`: `AUTH_MONGO_URI`, `JWT_SECRET` (in addition to `MONGO_URI`, `GROQ_API_KEY`).

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
| POST | `/api/auth/logout` | — clears the cookie |
| GET | `/api/auth/me` | — (requireAuth) returns `{ user }` for the current session |
| POST | `/api/auth/register` | (requireAuth) `{ name, email, password }` — creates another admin |

Response shape for GET `/api/properties`:
```json
{ "success": true, "properties": [...], "totalProperties": 300, "totalPages": 15, "currentPage": 1 }
```

## Property schema

```js
{ img, price, street, city, type, info1, rooms, floor, size, tags: [String], description }
// + createdAt / updatedAt (timestamps: true)
// + embedding (vector, excluded from /api/search responses via .select("-embedding"))
```

`type` accepted values in the AI chat tool (Hebrew, matching real DB values): `"דירה"`, `"בית פרטי/ קוטג'"`, `"גג/ פנטהאוז"`, `"דירת גן"`, `"דופלקס"`, `"סטודיו/ לופט"`. The same list is shared by the frontend (`frontend/src/lib/propertyTypes.js`) and used in `FilterBar`, `AddPropertyForm`, and `EditPropertyForm`.

## AI chat pipeline

`chatController.js` uses the OpenAI SDK pointed at Groq (`baseURL: "https://api.groq.com/openai/v1"`).

Unified agentic loop (`llama-3.3-70b-versatile`, up to 8 iterations) with three tools:

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

- `fetchPropertiesWithPagination` caps results at 300 total (`maxProperties = 300`).
- `adjustedLimit = Math.min(limit, 300 - skip)` prevents over-fetching near the cap.
- `price` filter uses MongoDB aggregation (`$addFields` + `$toDouble`) because the field type is `Number` but `maxPrice` comparison requires explicit casting.

## Key constraints

- Both servers must run simultaneously — the frontend has no mock/offline mode.
- All backend files use ESM (`"type": "module"` in both `package.json`s) — use `import`/`export`, not `require`.
- The app is fully Hebrew/RTL: `index.html` sets `lang="he" dir="rtl"`, all UI copy is Hebrew, and the AI chat assistant is instructed (via `SYSTEM_PROMPT` in `chatController.js`) to always reply in Hebrew regardless of the input language. Keep new user-facing strings in Hebrew; code identifiers/comments stay in English.
