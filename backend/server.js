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

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
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

app.use(authRoutes);
app.use(propertyRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
