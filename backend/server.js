import "dotenv/config";
import "./src/config/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import connectDB from "./src/config/db.js";
import "./src/config/authDb.js";
import propertyRoutes from "./src/routes/PropertyRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import inquiryRoutes from "./src/routes/InquiryRoutes.js";

const app = express();

// How many proxies sit in front of the app, so req.ip (and every rate limit) is
// the visitor's IP. Render alone is 1; Vercel's /api rewrite in front of Render
// makes it 2, and with 1 every visitor would share Vercel's IP and one limit.
if (process.env.NODE_ENV === "production") {
  const hops = Number(process.env.TRUST_PROXY_HOPS?.trim());
  app.set("trust proxy", Number.isInteger(hops) && hops > 0 ? hops : 1);
}

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.CORS_EXTRA_ORIGINS
    ? process.env.CORS_EXTRA_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : []),
];

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

connectDB();

app.use('/api',authRoutes);
app.use('/api',propertyRoutes);
app.use('/api',inquiryRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
