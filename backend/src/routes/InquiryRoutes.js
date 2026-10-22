import express from "express";
import rateLimit from "express-rate-limit";
import {
  addInquiry,
  getInquiries,
  setInquiryStatus,
} from "../controllers/InquiryController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// Same parsing as authRoutes.js: blank counts as unset, since a limit of 0 blocks every request.
const rawLimit = process.env.INQUIRY_RATE_LIMIT_MAX?.trim();
const parsedLimit = rawLimit ? Number(rawLimit) : NaN;
const limit = Number.isInteger(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 5;

const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many inquiries. Please try again later." },
});

router.post("/properties/:id/inquiries", inquiryLimiter, addInquiry);
router.get("/inquiries", requireAuth, getInquiries);
router.patch("/inquiries/:id", requireAuth, setInquiryStatus);

export default router;
