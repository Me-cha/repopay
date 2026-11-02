import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { AppShellSkeleton } from '../components/common/Skeleton.js';
import { useRouter } from './Router.js';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <AppShellSkeleton />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
