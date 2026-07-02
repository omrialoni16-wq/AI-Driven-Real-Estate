#!/usr/bin/env node
/**
 * Smoke driver for the Real Estate app.
 * Usage: node .claude/skills/run-real-estate/smoke.mjs [screenshot-path]
 *
 * Runs three checks:
 *   1. Backend API reachability + property count
 *   2. Filter API (city param)
 *   3. Chrome headless screenshot of the frontend
 *
 * Exits non-zero if any check fails.
 */

import { execSync } from "child_process";
import { existsSync } from "fs";

const BACKEND = "http://localhost:5000";
const FRONTEND = "http://localhost:5173";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const screenshotPath =
  process.argv[2] || "c:\\Users\\Windows\\AppData\\Local\\Temp\\real-estate-smoke.png";

let failed = false;

function check(label, fn) {
  process.stdout.write(`[check] ${label} ... `);
  try {
    fn();
    console.log("OK");
  } catch (e) {
    console.log(`FAIL: ${e.message}`);
    failed = true;
  }
}

// 1. Backend: properties endpoint
check("GET /api/properties returns 200 + data", () => {
  const raw = execSync(
    `curl -sf "${BACKEND}/api/properties?page=1&limit=3"`,
    { encoding: "utf8", timeout: 10000 }
  );
  const json = JSON.parse(raw);
  if (!json.success) throw new Error("success=false");
  if (!Array.isArray(json.properties) || json.properties.length === 0)
    throw new Error("empty properties array");
  console.log(`\n  total=${json.totalProperties}, returned=${json.properties.length}`);
});

// 2. Backend: filter by city
check("GET /api/properties?city=תל filters results", () => {
  const raw = execSync(
    `curl -sf "${BACKEND}/api/properties?page=1&limit=3&city=%D7%AA%D7%9C"`,
    { encoding: "utf8", timeout: 10000 }
  );
  const json = JSON.parse(raw);
  if (!json.success) throw new Error("success=false on filtered query");
});

// 3. Frontend screenshot
check(`Frontend screenshot → ${screenshotPath}`, () => {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}`);
  execSync(
    `"${CHROME}" --headless=new --screenshot="${screenshotPath}" --window-size=1440,900 --no-sandbox --virtual-time-budget=5000 "${FRONTEND}"`,
    { timeout: 30000, stdio: "pipe" }
  );
  if (!existsSync(screenshotPath)) throw new Error("screenshot file not created");
  console.log(`\n  Screenshot saved to ${screenshotPath}`);
});

process.exit(failed ? 1 : 0);
