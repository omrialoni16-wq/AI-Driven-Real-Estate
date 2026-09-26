import express from "express";
import rateLimit from "express-rate-limit";
import { login, logout, me, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// Blank counts as unset: Number("") is 0, and a limit of 0 blocks every request.
const rawLimit = process.env.AUTH_RATE_LIMIT_MAX?.trim();
const parsedLimit = rawLimit ? Number(rawLimit) : NaN;
const limit = Number.isInteger(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 10;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

router.post("/auth/login", authLimiter, login);
router.post("/auth/logout", logout);
router.get("/auth/me", requireAuth, me);
router.post("/auth/register", requireAuth, authLimiter, register);

export default router;
