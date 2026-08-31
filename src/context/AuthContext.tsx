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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const session: UserSession = JSON.parse(stored);
        // Check if token is expired
        if (session.expires_at && session.expires_at > Math.floor(Date.now() / 1000)) {
          setUser(session);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to parse stored session', e);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (staffCode: string, pin: string) => {
    setIsLoading(true);
    const { session, error } = await loginWithPin(staffCode, pin);
    setIsLoading(false);

    if (error || !session) {
      return { success: false, error: error || 'Login failed' };
    }

    setUser(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
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
