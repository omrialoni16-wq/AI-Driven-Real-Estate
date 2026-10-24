import axios from "axios";
import { toast } from "sonner";

// On this machine, requests go to the backend on port 5000. Anywhere else (the
// Vercel site) they go to /api/... on the site's own origin, where Vercel runs
// the backend (api/index.js), so the session cookie stays first-party. Decided
// by hostname, not build mode: a build made with a stray NODE_ENV would
// otherwise send visitors to their own localhost. VITE_API_URL overrides both.
const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ?? (isLocalhost ? "http://localhost:5000" : ""),
  withCredentials: true,
});

// The demo admin is read-only: every write it tries comes back 403 with this
// code. One toast here covers all the admin forms, so they skip their own error.
export const isDemoReadOnly = (error) =>
  error?.response?.data?.code === "DEMO_READ_ONLY";

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isDemoReadOnly(error)) {
      toast.info("מצב דמו: השינויים לא נשמרים", {
        description: "בגרסה האמיתית הפעולה הזו הייתה מתבצעת.",
      });
    }
    return Promise.reject(error);
  },
);

export default api;
