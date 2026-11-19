import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loginUser, registerUser, getCurrentUser } from "../services/authApi";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(
    () => !!localStorage.getItem("token"),
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    getCurrentUser()
      .then((data) => setUser(data.user || null))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setRestoring(false));
  }, []);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    try {
      const response = await loginUser(credentials);
      if (response.token) localStorage.setItem("token", response.token);
      setUser(response.user);
      return response;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (userData) => {
    setLoading(true);
    try {
      const response = await registerUser(userData);
      if (response.token) localStorage.setItem("token", response.token);
      setUser(response.user);
      return response;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, restoring, login, register, logout }),
    [user, loading, restoring, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
