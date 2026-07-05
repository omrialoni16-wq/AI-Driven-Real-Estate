import express from "express";
import {
  addProperty,
  getAllProperties,
  removeProperty,
  updateProperty,
  getPropertiesByFilter,
  getPropertyLocation
} from "../controllers/propertyController.js";

import { handleChat } from "../controllers/chatController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

router.get("/api/properties", getAllProperties);
router.post("/api/properties", requireAuth, addProperty);
router.delete("/api/properties/:id", requireAuth, removeProperty);
router.put("/api/properties/:id", requireAuth, updateProperty);
router.post("/api/chat", requireAuth, handleChat);
router.get("/api/search", getPropertiesByFilter);
router.get("/api/properties/:id/location", getPropertyLocation);

export default router;
