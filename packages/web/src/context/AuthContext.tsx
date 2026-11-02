import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ReadError } from '../api.js';

export interface UserSession {
  id: string;
  login: string;
  operator: boolean;
  heartbeatSeconds: number;
  csrf?: string | undefined;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  error: string | null;
  refreshAuth: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  refreshAuth: async () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAuth = async () => {
    try {
      setLoading(true);
      const data = await api.me();
      setUser(data);
      setError(null);
    } catch (err) {
      setUser(null);
      if (err instanceof ReadError && err.status === 401) {
        setError(null); // Normal signed-out state
      } else {
        setError(err instanceof Error ? err.message : 'Authentication check failed');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        refreshAuth,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
