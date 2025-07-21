import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuthToken, setAuthToken, removeAuthToken, getUserFromToken, login as apiLogin, signup as apiSignup, User } from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
  interviewBlocked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [user, setUser] = useState<User | null>(getUserFromToken(token));
  const [interviewBlocked, setInterviewBlocked] = useState(false);

  useEffect(() => {
    setUser(getUserFromToken(token));
    if (token) setAuthToken(token);
    else removeAuthToken();
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setToken(res.token);
    setUser(res.user);
    // Check for terminated interview
    fetch(`/api/candidates/by-email/${encodeURIComponent(email)}`)
      .then(res => res.json())
      .then(candidate => {
        if (candidate && candidate.id) {
          fetch(`/api/candidates/${candidate.id}/results`)
            .then(res => res.json())
            .then(results => {
              if (Array.isArray(results)) {
                const hasTerminated = results.some(r => r.interview?.status === 'terminated');
                setInterviewBlocked(hasTerminated);
              }
            });
        }
      });
  };

  const signup = async (email: string, password: string, role?: string) => {
    await apiSignup(email, password, role);
    // Optionally auto-login after signup
    await login(email, password);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    removeAuthToken();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, interviewBlocked }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
} 