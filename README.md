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

Everything runs as one Vercel project: `frontend/` is built into the static site, and `api/index.js` runs the `backend/` Express app as a Vercel Function. `vercel.json` sends every `/api/*` request to that function, so the site and the API share one origin and the session cookie is first-party.

1. **MongoDB Atlas:** Vercel's outbound IPs aren't fixed, so the cluster's Network Access list must allow `0.0.0.0/0`.
2. **Import the repo in Vercel** (Add New → Project). Keep the Root Directory as the repository root; `vercel.json` sets the install, build and output settings.
3. **Environment variables:** `MONGO_URI`, `AUTH_MONGO_URI`, `GROQ_API_KEY`, `JWT_SECRET` (a new random one, 32+ characters) and `NODE_ENV=production`.
4. **Deploy.** Every push to `main` redeploys.

Rate limits are kept in each function instance's memory, so on Vercel they are approximate; the demo's one-chat-message rule is stored in MongoDB and is exact.

## Tests

The API test suite treats the backend as a black box over HTTP, against its own test databases. It covers authentication, admin-only authorization, listing CRUD, validation, search and pagination. CI runs it on every push and pull request against a throwaway MongoDB, with no repository secrets.

- [api-tests/README.md](api-tests/README.md): how to run it
- [api-tests/FINDINGS.md](api-tests/FINDINGS.md): the weaknesses the tests found in this API, with reproduction steps
- [api-tests/LEARNING_NOTES.md](api-tests/LEARNING_NOTES.md): how the suite is designed, and why
