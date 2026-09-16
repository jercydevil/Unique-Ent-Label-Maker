// src/context/AuthContext.tsx
// Persistent authentication context for staff and admin sessions

import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginWithPin, type UserSession } from '../lib/supabase';

interface AuthContextType {
  user: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (staffCode: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'unique_ent_auth_session';

const readStoredSession = (): UserSession | null => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const session: UserSession = JSON.parse(stored);
    if (session.expires_at && session.expires_at > Math.floor(Date.now() / 1000)) {
      return session;
    }

    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedSession = readStoredSession();
    setUser(storedSession);
    setIsLoading(false);
  }, []);

  const login = async (staffCode: string, pin: string) => {
    setIsLoading(true);
    const { session, error } = await loginWithPin(staffCode, pin);
    setIsLoading(false);

    if (error || !session) {
      return { success: false, error: error || 'Login failed' };
    }

    setUser(session);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
