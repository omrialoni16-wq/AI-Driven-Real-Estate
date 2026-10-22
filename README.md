# AI-Driven Real Estate

[![API tests](https://github.com/omrialoni16-wq/AI-Driven-Real-Estate/actions/workflows/api-tests.yml/badge.svg?branch=main)](https://github.com/omrialoni16-wq/AI-Driven-Real-Estate/actions/workflows/api-tests.yml)

A full-stack property listings app in Hebrew. Guests browse, filter and page through listings; logged-in admins add, edit and delete them, by hand or by talking to an AI assistant that collects the details conversationally.

- **Frontend:** React 19 + Vite, Tailwind CSS + shadcn/ui, fully right-to-left
- **Backend:** Node.js + Express 5 + MongoDB (Mongoose), layered as routes → controllers → services
- **Auth:** admin-only JWT in an httpOnly cookie, bcrypt password hashes, admin accounts in a separate database cluster
- **AI assistant:** Groq-hosted LLM with tool calling (add a property, price statistics, search)
- **Tests:** a Python + pytest API test suite that runs on every push (the badge above)

## Repository layout

```
backend/     Express API (port 5000)
frontend/    React app (port 5173)
api-tests/   pytest API test suite: see api-tests/README.md
.github/     CI workflow that runs the API tests
```

## Running the app

Both servers must run at the same time. The backend needs a `backend/.env`; see `backend/.env.example` for the variables.

```bash
# Terminal 1
cd backend && npm install && node server.js

# Terminal 2
cd frontend && npm install && npm run dev
```

## Admin demo

The header's "כניסה כאדמין דמו" button logs a visitor in as a read-only demo admin: every admin screen is visible, the server rejects every change, the inquiries panel shows made-up guests, and the AI assistant answers one message.

## Deployment

The frontend runs on Vercel and the backend on Render. Vercel forwards `/api/*` to Render (`frontend/vercel.json`), so the browser only ever talks to the Vercel domain and the session cookie stays first-party (cross-site cookies are blocked by Safari and in private windows).

**Backend (Render):** create the service from `render.yaml`, then set `MONGO_URI`, `AUTH_MONGO_URI`, `GROQ_API_KEY`, `JWT_SECRET` and `CORS_EXTRA_ORIGINS` (the Vercel site's origin, e.g. `https://your-app.vercel.app`) in the dashboard. `TRUST_PROXY_HOPS=2` is already set: requests pass through Vercel and Render's proxy, and with the wrong count every visitor would share one rate limit.

**Frontend (Vercel):** project root `frontend`, framework Vite. Replace `YOUR-RENDER-SERVICE` in `frontend/vercel.json` with the Render service's host. No environment variables are needed: a production build calls `/api/...` on its own origin.

**MongoDB Atlas:** Render's outbound IPs aren't fixed, so both clusters' Network Access lists must allow `0.0.0.0/0`.

Render's free tier sleeps when idle, so the first request after a while (including the first demo login) can take about a minute.

## Tests

The API test suite treats the backend as a black box over HTTP, against its own test databases. It covers authentication, admin-only authorization, listing CRUD, validation, search and pagination. CI runs it on every push and pull request against a throwaway MongoDB, with no repository secrets.

- [api-tests/README.md](api-tests/README.md): how to run it
- [api-tests/FINDINGS.md](api-tests/FINDINGS.md): the weaknesses the tests found in this API, with reproduction steps
- [api-tests/LEARNING_NOTES.md](api-tests/LEARNING_NOTES.md): how the suite is designed, and why
