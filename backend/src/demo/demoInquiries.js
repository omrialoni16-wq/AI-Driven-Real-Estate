import Property from "../models/Property.js";
import { INQUIRY_STATUSES } from "../models/Inquiry.js";

// What the demo admin sees in the inquiries panel instead of real guests'
// contact details. Never stored: built on each request.
const HOUR_MS = 60 * 60 * 1000;

const DEMO_INQUIRIES = [
  { name: "נועה כהן", phone: "050-0000001", email: "noa.demo@example.com", status: "new", hoursAgo: 2, message: "שלום, הנכס עדיין זמין? אשמח לתאם ביקור בשבוע הבא." },
  { name: "אבי לוי", phone: "052-0000002", status: "new", hoursAgo: 5, message: "האם יש חניה צמודה ומחסן? ומה גובה הארנונה?" },
  { email: "dana.demo@example.com", name: "דנה מזרחי", status: "in_progress", hoursAgo: 20, message: "מעוניינת בנכס. יש גמישות במחיר?" },
  { name: "יוסי פרץ", phone: "054-0000004", status: "new", hoursAgo: 26, message: "אפשר לקבל פרטים על מצב הבניין ועל ועד הבית?" },
  { name: "מיכל אברהם", phone: "053-0000005", email: "michal.demo@example.com", status: "in_progress", hoursAgo: 48, message: "ראינו את הדירה בסוף השבוע ואנחנו מאוד מתעניינים. מה השלב הבא?" },
  { name: "רון שפירא", email: "ron.demo@example.com", status: "closed", hoursAgo: 72, message: "תודה על הסיור, החלטנו להמשיך לחפש באזור אחר." },
  { phone: "058-0000007", status: "new", hoursAgo: 80, message: "מתי אפשר להיכנס לנכס? אנחנו צריכים כניסה עד החגים." },
  { name: "שירה ביטון", phone: "050-0000008", status: "in_progress", hoursAgo: 100, message: "האם הנכס מתאים למשפחה עם שני ילדים קטנים? יש גנים בסביבה?" },
  { name: "עומר דהן", email: "omer.demo@example.com", status: "closed", hoursAgo: 150, message: "סגרנו עסקה על נכס אחר, תודה רבה על הזמינות." },
  { name: "תמר גולן", phone: "052-0000010", email: "tamar.demo@example.com", status: "new", hoursAgo: 170, message: "יש אפשרות לשכירות עם אופציה לקנייה?" },
  { name: "איתי רוזן", phone: "054-0000011", status: "closed", hoursAgo: 240, message: "המחיר מעל התקציב שלנו כרגע. אשמח לעדכון אם יירד." },
  { name: "ליאת חדד", email: "liat.demo@example.com", status: "new", hoursAgo: 300, message: "האם הדירה משופצת? אפשר לקבל תמונות נוספות של המטבח?" },
];

export const listDemoInquiries = async ({ status, page = 1, limit = 20 } = {}) => {
  // Real properties, so each card shows a real address and the panel looks the
  // same as it does for a real admin.
  const properties = await Property.find()
    .sort({ createdAt: -1 })
    .limit(DEMO_INQUIRIES.length)
    .select("street city price img")
    .lean();

  const now = Date.now();
  const all = DEMO_INQUIRIES.map(({ hoursAgo, ...inquiry }, i) => {
    const createdAt = new Date(now - hoursAgo * HOUR_MS);
    return {
      _id: `demo-inquiry-${i + 1}`,
      ...inquiry,
      property: properties.length ? properties[i % properties.length] : null,
      ...(inquiry.status === "closed" && { closedAt: createdAt }),
      createdAt,
      updatedAt: createdAt,
    };
  });

  const filtered = INQUIRY_STATUSES.includes(status)
    ? all.filter((inquiry) => inquiry.status === status)
    : all;

  // Same paging rules and response shape as listInquiries in InquiryService.js.
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  return {
    inquiries: filtered.slice(skip, skip + limitNum),
    totalInquiries: filtered.length,
    totalPages: Math.ceil(filtered.length / limitNum),
    currentPage: pageNum,
  };
};
