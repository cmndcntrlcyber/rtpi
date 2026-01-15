import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  authMethod: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: () => boolean;
  isOperator: () => boolean;
  isViewer: () => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const response = await api.get<{ user: User }>("/auth/me");
      setUser(response.user);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    // Get CSRF token
    const csrfResponse = await api.get<{ csrfToken: string }>("/auth/csrf-token");
    const { csrfToken } = csrfResponse;

    // Login with CSRF token
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Login failed");
    }

    const data = await response.json();
    setUser(data.user);
  };

  const logout = async () => {
    try {
      // Use plain fetch() instead of api.post() to avoid triggering
      // the 401 handler if session is already expired
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Log response for debugging (non-blocking)
      if (!response.ok) {
        console.warn("Logout request returned non-OK status:", response.status);
      }
    } catch (error) {
      // Non-fatal: session might already be expired or network issue
      console.error("Logout error:", error);
    } finally {
      // Always clear local user state, regardless of API call result
      setUser(null);
    }
  };

  const refreshUser = async () => {
    await checkSession();
  };

  const isAdmin = () => user?.role === "admin";
  const isOperator = () => user?.role === "operator";
  const isViewer = () => user?.role === "viewer";
  const hasRole = (role: string) => user?.role === role;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        isAdmin,
        isOperator,
        isViewer,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
