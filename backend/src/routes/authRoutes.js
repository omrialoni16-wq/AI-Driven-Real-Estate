import express from "express";
import rateLimit from "express-rate-limit";
import { login, logout, me, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

router.post("/auth/login", authLimiter, login);
router.post("/auth/logout", logout);
router.get("/auth/me", requireAuth, me);
router.post("/auth/register", requireAuth, authLimiter, register);

export default router;
