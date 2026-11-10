import { WalletPage } from './pages/WalletPage.js';
import { AppShell } from './components/layout/AppShell.js';
import { AuthProvider } from './context/AuthContext.js';
import { WorkspaceDataProvider } from './context/WorkspaceDataContext.js';
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboardPage.js';
import { ContributionsPage } from './pages/ContributionsPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { PayoutsPage } from './pages/PayoutsPage.js';
import { SignInPage } from './pages/SignInPage.js';
import { ProtectedRoute } from './router/ProtectedRoute.js';
import { RouterProvider, useRouter } from './router/Router.js';

function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}

function DashboardOutlet() {
  const { path } = useRouter();
  const clean = normalizePath(path);

  if (clean === '/dashboard/wallet') return <WalletPage />;
  if (clean === '/dashboard') {
    return <AnalyticsDashboardPage />;
  }
  if (clean === '/dashboard/contributions') {
    return <ContributionsPage />;
  }
  if (clean === '/dashboard/payouts' || clean === '/dashboard/payouts/settings') {
    return <PayoutsPage />;
  }

  return <NotFoundPage />;
}

function AppRoutes() {
  const { path } = useRouter();
  const clean = normalizePath(path);

  if (clean === '/' || clean === '/login') {
    return <SignInPage />;
  }

  if (clean === '/dashboard' || clean.startsWith('/dashboard/')) {
    return (
      <ProtectedRoute>
        <WorkspaceDataProvider>
          <AppShell>
            <DashboardOutlet />
          </AppShell>
        </WorkspaceDataProvider>
      </ProtectedRoute>
    );
  }

  return <NotFoundPage />;
}

export function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </RouterProvider>
  );
}
