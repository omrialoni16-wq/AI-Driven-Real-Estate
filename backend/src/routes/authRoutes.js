import express from "express";
import rateLimit from "express-rate-limit";
import { demoLogin, login, logout, me, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { blockDemo } from "../middleware/blockDemo.js";

const router = express.Router();

// Blank counts as unset: Number("") is 0, and a limit of 0 blocks every request.
const limitFromEnv = (name, fallback) => {
  const raw = process.env[name]?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: limitFromEnv("AUTH_RATE_LIMIT_MAX", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

// Separate from authLimiter so portfolio visitors trying the demo don't use up
// the real admins' login attempts.
const demoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: limitFromEnv("DEMO_RATE_LIMIT_MAX", 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many demo logins. Please try again later." },
});

router.post("/auth/login", authLimiter, login);
router.post("/auth/logout", logout);
router.get("/auth/me", requireAuth, me);
router.post("/auth/register", requireAuth, blockDemo, authLimiter, register);

// DEMO_ENABLED=false removes the route, so it answers 404 like any unknown path.
if (process.env.DEMO_ENABLED?.trim() !== "false") {
  router.post("/auth/demo", demoLimiter, demoLogin);
}

export default router;
