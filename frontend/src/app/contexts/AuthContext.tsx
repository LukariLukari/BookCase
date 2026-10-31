'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { stopDevicePush } from '@/lib/webPushClient';

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearStoredSession() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  } catch {
    // Storage may be unavailable in restricted browser environments.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const requiresLogin = pathname === '/' || pathname === '/business' ||
    pathname.startsWith('/business/') || pathname === '/admin' || pathname.startsWith('/admin/');

  // Restore browser-only storage after hydration; the server has no session storage.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('access_token') || localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;

      if (storedToken && parsedUser && typeof parsedUser.id === 'string' &&
          typeof parsedUser.username === 'string' && typeof parsedUser.role === 'string') {
        setToken(storedToken);
        setUser(parsedUser);
      } else {
        clearStoredSession();
      }
    } catch {
      clearStoredSession();
    } finally {
      setIsLoading(false);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!isLoading && requiresLogin && (!user || !token)) {
      router.replace('/login');
    }
  }, [isLoading, requiresLogin, user, token, router, pathname]);

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);
    try {
      localStorage.setItem('token', newToken);
      localStorage.setItem('access_token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch {
      clearStoredSession();
    }
    router.replace(userData.role === 'admin' ? '/admin' : '/business/daily');
  };

  const logout = async () => {
    if (token) {
      try { await stopDevicePush(token); }
      catch { /* Local unsubscribe is attempted even if the server is offline. */ }
    }
    setToken(null);
    setUser(null);
    clearStoredSession();
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {requiresLogin && (isLoading || !user || !token) ? (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fef9f4] px-4 text-[#585556]">
          <p role="status">{isLoading ? 'Đang kiểm tra phiên đăng nhập...' : 'Đang chuyển đến trang đăng nhập...'}</p>
          <a href="/login" className="font-bold underline">Đến trang đăng nhập</a>
        </main>
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
