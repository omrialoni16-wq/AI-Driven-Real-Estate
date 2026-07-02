import express from "express";
import { login, logout, me, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

router.post("/api/auth/login", login);
router.post("/api/auth/logout", logout);
router.get("/api/auth/me", requireAuth, me);
router.post("/api/auth/register", requireAuth, register);

export default router;
