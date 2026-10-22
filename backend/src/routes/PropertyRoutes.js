import express from "express";
import rateLimit from "express-rate-limit";
import {
  addProperty,
  getAllProperties,
  removeProperty,
  updateProperty,
  getPropertiesByFilter,
  getPropertyLocation
} from "../controllers/PropertyController.js";

import { handleChat } from "../controllers/chatController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { blockDemo } from "../middleware/blockDemo.js";

const router = express.Router();

// Each demo login gets one chat message, but anyone can log in to the demo again
// for a fresh one. This caps the Groq calls per IP; real admins skip it.
// Blank counts as unset, as in authRoutes.js.
const rawDemoChatLimit = process.env.DEMO_CHAT_RATE_LIMIT_MAX?.trim();
const parsedDemoChatLimit = rawDemoChatLimit ? Number(rawDemoChatLimit) : NaN;

const demoChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit:
    Number.isInteger(parsedDemoChatLimit) && parsedDemoChatLimit >= 0
      ? parsedDemoChatLimit
      : 5,
  skip: (req) => !req.user?.isDemo,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "DEMO_CHAT_LIMIT", message: "Too many demo chat messages. Please try again later." },
});

router.get("/properties", getAllProperties);
router.post("/properties", requireAuth, blockDemo, addProperty);
router.delete("/properties/:id", requireAuth, blockDemo, removeProperty);
router.put("/properties/:id", requireAuth, blockDemo, updateProperty);
router.post("/chat", requireAuth, demoChatLimiter, handleChat);
router.get("/search", getPropertiesByFilter);
router.get("/properties/:id/location", getPropertyLocation);

export default router;
