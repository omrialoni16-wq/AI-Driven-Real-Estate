import Inquiry, { INQUIRY_STATUSES } from "../models/Inquiry.js";
import Property from "../models/Property.js";

export const createInquiry = async (propertyId, data = {}) => {
  const property = await Property.exists({ _id: propertyId });
  if (!property) return null;

  // Whitelist guest-controlled fields so the body can't set status or property.
  const { name, phone, email, message } = data;
  return await Inquiry.create({
    property: propertyId,
    name: name || undefined,
    phone: phone || undefined,
    email: email || undefined,
    message,
  });
};

export const listInquiries = async ({ status, page = 1, limit = 20 } = {}) => {
  const query = {};
  if (INQUIRY_STATUSES.includes(status)) {
    query.status = status;
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [totalInquiries, inquiries] = await Promise.all([
    Inquiry.countDocuments(query),
    Inquiry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("property", "street city price img")
      .lean(),
  ]);

  return {
    inquiries,
    totalInquiries,
    totalPages: Math.ceil(totalInquiries / limitNum),
    currentPage: pageNum,
  };
};

export const updateInquiryStatus = async (id, status) => {
  // Closing starts the retention countdown; reopening cancels it.
  const update =
    status === "closed"
      ? { status, closedAt: new Date() }
      : { status, $unset: { closedAt: 1 } };

  return await Inquiry.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).populate("property", "street city price img");
};
