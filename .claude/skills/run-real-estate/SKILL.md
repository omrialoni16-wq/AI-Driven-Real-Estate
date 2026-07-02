---
name: run-real-estate
description: Run, start, build, screenshot, or verify the Real Estate property listings app (Express backend + React/Vite frontend). Use when asked to launch, test, or take a screenshot of the real estate app.
---

# Run: Real Estate App

Fullstack property listings app. Backend is Express + Mongoose on port 5000; frontend is React + Vite on port 5173. The smoke driver at `.claude/skills/run-real-estate/smoke.mjs` checks the API and takes a screenshot using Chrome headless — that is the primary agent interaction path.

## Prerequisites

- Node.js ≥ 18
- Google Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe` (already present on this machine)
- MongoDB accessible via `MONGO_URI` in `backend/.env` (already configured)

## Setup

```powershell
cd frontend
npm install
cd ../backend
npm install
```

## Start the servers

Open two terminals (or background processes):

```powershell
# Terminal 1 — backend (port 5000)
cd backend
node server.js

# Terminal 2 — frontend (port 5173)
cd frontend
npm run dev
```

Both must be running before the smoke script or a screenshot will work. Confirm startup by looking for:
- Backend: `Server is running on port 5000` + `Connected to MongoDB Successfully`
- Frontend: `VITE vX ready in … ms` + `Local: http://localhost:5173/`

## Run (agent path) — smoke script

With both servers running, execute from the repo root:

```powershell
node .claude/skills/run-real-estate/smoke.mjs
```

This runs three checks:
1. `GET /api/properties?page=1&limit=3` — verifies API returns data (total=300 in dev)
2. `GET /api/properties?city=תל` — verifies city filter works
3. Chrome headless screenshot saved to `C:\Users\Windows\AppData\Local\Temp\real-estate-smoke.png`

Pass a custom screenshot path as the first argument:

```powershell
node .claude/skills/run-real-estate/smoke.mjs C:\path\to\out.png
```

Exits 0 on all-pass, 1 on any failure.

## Backend API reference

All endpoints served at `http://localhost:5000`:

| Method | Path | Notes |
|---|---|---|
| GET | `/api/properties` | `?page=1&limit=21&city=…&maxPrice=…&type=…` |
| POST | `/api/properties` | body: `{ img, price, street, city, type, rooms, floor, size, tags, description }` |
| PUT | `/api/properties/:id` | partial update |
| DELETE | `/api/properties/:id` | |
| POST | `/api/chat` | body: `{ message, history[] }` — returns `{ reply, updatedHistory }` (requires `GROQ_API_KEY` in `backend/.env`) |
| GET | `/api/search` | `?city=…&type=…&minPrice=…&maxPrice=…&rooms=…&floor=…&minSize=…&maxSize=…&tags[]=…` |

Quick API test (PowerShell):
```powershell
Invoke-RestMethod "http://localhost:5000/api/properties?page=1&limit=2" | Select-Object success, totalProperties
```

## Run (human path)

Start both servers as shown above, then open `http://localhost:5173` in a browser. The `+` FAB adds a property; each card has Delete and Edit buttons. The AI Assistant panel is in the bottom-left.


## Troubleshooting

| Symptom | Fix |
|---|---|
| Backend exits immediately | Check `backend/.env` has `MONGO_URI`; MongoDB must be reachable |
| Screenshot file is 0 bytes or not created | Confirm Vite is running on 5173 before running the smoke script |
| `EADDRINUSE 5000` | Kill the existing backend process: `Get-Process node \| Stop-Process` (PowerShell) |
| Properties grid shows "No properties match your filters" | Backend connected but DB is empty — seed data or relax filters |
