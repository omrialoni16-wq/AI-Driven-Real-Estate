import mongoose from "mongoose";

export const INQUIRY_STATUSES = ["new", "in_progress", "closed"];

// Guest contact details are personal data: keep them only as long as needed.
// A closed inquiry is deleted this long after it was closed (shown to guests in InquiryForm.jsx).
export const CLOSED_INQUIRY_RETENTION_DAYS = 180;

const inquirySchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "apartments",
      required: true,
      index: true,
    },
    name: { type: String, trim: true, maxlength: 100 },
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9+\-\s()]{7,20}$/, "Invalid phone number."],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address."],
    },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: INQUIRY_STATUSES, default: "new" },
    // Set only while status is "closed". MongoDB's TTL monitor deletes the
    // document once this is older than the retention period; documents
    // without it (open inquiries) are never expired.
    closedAt: { type: Date },
  },
  { timestamps: true },
);

inquirySchema.index(
  { closedAt: 1 },
  { expireAfterSeconds: CLOSED_INQUIRY_RETENTION_DAYS * 24 * 60 * 60 },
);

// A guest has no account, so a way to reach them back is mandatory.
inquirySchema.pre("validate", function () {
  if (!this.phone && !this.email) {
    this.invalidate("phone", "Phone or email is required.");
  }
});

export default mongoose.model("Inquiry", inquirySchema);
