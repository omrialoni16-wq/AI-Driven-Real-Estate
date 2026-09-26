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

## Tests

The API test suite treats the backend as a black box over HTTP, against its own test databases. It covers authentication, admin-only authorization, listing CRUD, validation, search and pagination. CI runs it on every push and pull request against a throwaway MongoDB, with no repository secrets.

- [api-tests/README.md](api-tests/README.md): how to run it
- [api-tests/FINDINGS.md](api-tests/FINDINGS.md): the weaknesses the tests found in this API, with reproduction steps
- [api-tests/LEARNING_NOTES.md](api-tests/LEARNING_NOTES.md): how the suite is designed, and why
