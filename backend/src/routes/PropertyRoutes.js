import express from "express";
import {
  addProperty,
  getAllProperties,
  removeProperty,
  updateProperty,
  getPropertiesByFilter 
} from "../controllers/propertyController.js";

import { handleChat } from "../controllers/chatController.js";

const router = express.Router();

router.get("/api/properties", getAllProperties);
router.post("/api/properties", addProperty);
router.delete("/api/properties/:id", removeProperty);
router.put("/api/properties/:id", updateProperty);
router.post("/api/chat", handleChat);
router.get("/api/search", getPropertiesByFilter);

export default router;
