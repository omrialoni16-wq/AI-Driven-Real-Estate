import {
  createInquiry,
  listInquiries,
  updateInquiryStatus,
} from "../service/InquiryService.js";
import { INQUIRY_STATUSES } from "../models/Inquiry.js";

const isClientError = (error) =>
  error.name === "ValidationError" || error.name === "CastError";

export const addInquiry = async (req, res) => {
  try {
    // Honeypot: the "website" field is hidden from humans, so only bots fill it.
    // Pretend success so they don't retry with a different payload.
    if (req.body?.website) {
      return res.status(201).json({ success: true });
    }

    const inquiry = await createInquiry(req.params.id, req.body);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    res.status(201).json({ success: true, inquiry });
  } catch (error) {
    if (isClientError(error)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Error adding inquiry:", error);
    res.status(500).json({ success: false, message: "Server Error: Could not save inquiry" });
  }
};

export const getInquiries = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const result = await listInquiries({ status, page, limit });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error in getInquiries controller", error);
    res.status(500).json({ success: false, message: "Server Error: Could not fetch inquiries" });
  }
};

export const setInquiryStatus = async (req, res) => {
  try {
    const status = req.body?.status;
    if (!INQUIRY_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${INQUIRY_STATUSES.join(", ")}`,
      });
    }

    const inquiry = await updateInquiryStatus(req.params.id, status);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found" });
    }
    res.status(200).json({ success: true, inquiry });
  } catch (error) {
    if (isClientError(error)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Error updating inquiry:", error);
    res.status(500).json({ success: false, message: "Server Error: Could not update inquiry" });
  }
};
