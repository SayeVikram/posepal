import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, api } from '@/services/mockData';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isTherapist: boolean;
  login: (email: string, password: string) => boolean;
  register: (name: string, email: string, password: string, role: 'therapist' | 'patient') => User;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('pose_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const login = (email: string, _password: string): boolean => {
    const found = api.login(email, _password);
    if (found) {
      setUser(found);
      localStorage.setItem('pose_user', JSON.stringify(found));
      return true;
    }
    return false;
  };

  const register = (name: string, email: string, _password: string, role: 'therapist' | 'patient') => {
    const newUser = api.register(name, email, role);
    setUser(newUser);
    localStorage.setItem('pose_user', JSON.stringify(newUser));
    return newUser;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pose_user');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isTherapist: user?.role === 'therapist', login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
