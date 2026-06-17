/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setAuthToken } from "../lib/api";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("signflow_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("signflow_token");
    if (!token) {
      setUser(null);
    }
  }, []);

  const persist = (token: string, u: User) => {
    setAuthToken(token);
    localStorage.setItem("signflow_user", JSON.stringify(u));
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { token, user: u } = await api.login({ email, password });
      persist(token, u);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const { token, user: u } = await api.register({ name, email, password });
      persist(token, u);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null);
    localStorage.removeItem("signflow_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
