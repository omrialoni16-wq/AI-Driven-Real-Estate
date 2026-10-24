// Vercel entry point: the whole Express API runs as this one function.
// vercel.json rewrites every /api/* request here, and Express still sees the
// original path, so the routes in backend/ work unchanged.
export { default } from "../backend/server.js";
