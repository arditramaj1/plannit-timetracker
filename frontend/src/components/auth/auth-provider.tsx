"use client";

import { createContext, type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { clearStoredAuth, getStoredAuth, setStoredAuth } from "@/lib/auth-storage";
import { AuthPayload, User } from "@/lib/types";
import { getCurrentUser, loginRequest, logoutRequest } from "@/services/api";

type AuthContextValue = {
  user: User | null;
  isInitialized: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: (user: User | null) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const auth = getStoredAuth();
      if (!auth) {
        if (mounted) {
          setIsInitialized(true);
        }
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (mounted) {
          setUser(currentUser);
          setStoredAuth({ ...auth, user: currentUser } as AuthPayload);
        }
      } catch {
        clearStoredAuth();
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsInitialized(true);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  async function login(username: string, password: string) {
    setIsLoading(true);
    try {
      const payload = await loginRequest(username, password);
      setStoredAuth(payload);
      setUser(payload.user);
      router.push("/calendar");
      router.refresh();
      return payload.user;
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    logoutRequest();
    setUser(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <AuthContext.Provider value={{ user, isInitialized, isLoading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
