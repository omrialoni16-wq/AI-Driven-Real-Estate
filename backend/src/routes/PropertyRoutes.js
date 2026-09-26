import express from "express";
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

const router = express.Router();

router.get("/properties", getAllProperties);
router.post("/properties", requireAuth, addProperty);
router.delete("/properties/:id", requireAuth, removeProperty);
router.put("/properties/:id", requireAuth, updateProperty);
router.post("/chat", requireAuth, handleChat);
router.get("/search", getPropertiesByFilter);
router.get("/properties/:id/location", getPropertyLocation);

export default router;
