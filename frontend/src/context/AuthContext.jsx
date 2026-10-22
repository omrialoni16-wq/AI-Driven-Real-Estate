import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext({
  user: null,
  isLoading: true,
  login: async () => {},
  loginDemo: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/api/auth/login", { email, password });
    setUser(res.data.user);
  };

  // Read-only demo admin for portfolio visitors: no credentials, the server
  // issues a short demo session.
  const loginDemo = async () => {
    const res = await api.post("/api/auth/demo");
    setUser(res.data.user);
  };

  const logout = async () => {
    await api.post("/api/auth/logout");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
