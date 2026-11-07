import { DashboardTour } from '../onboarding/DashboardTour.js';
import { useState, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspaceData } from '../../context/WorkspaceDataContext.js';
import { BrandEmblem, IconMenu, Spinner } from '../common/Icons.js';
import { UserAvatar } from '../common/UserAvatar.js';
import { BountyDetailModal } from '../pr/BountyDetailModal.js';
import { Sidebar } from './Sidebar.js';

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { error, refreshing, refreshAll } = useWorkspaceData();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="c2-shell">
      <a href="#content" className="c2-skip-link">
        Skip to content
      </a>

      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => { setMobileOpen(false); }}
      />

      <div className="c2-main-col">
        {/* Compact mobile bar (< 960px only) — Payout Settings lives strictly in Sidebar */}
        <header className="c2-mobile-bar">
          <div className="c2-mobile-brand">
            <button
              type="button"
              className="c2-icon-btn"
              onClick={() => { setMobileOpen(true); }}
              aria-label="Open navigation menu"
            >
              <IconMenu size={20} />
            </button>
            <BrandEmblem size={32} />
            <span className="c2-brand-name">Repopay</span>
          </div>
          {user && <UserAvatar login={user.login} size={30} />}
        </header>

        <main id="content" className="c2-outlet">
          {error && (
            <div role="alert" className="c2-alert-banner">
              <span>{error}</span>
              <button
                type="button"
                className="c2-btn c2-btn-secondary c2-btn-sm"
                onClick={refreshAll}
                disabled={refreshing}
              >
                {refreshing && <Spinner size={14} />}
                <span>Try again</span>
              </button>
            </div>
          )}

          {children}
        </main>
      </div>

      <BountyDetailModal />
      <DashboardTour closeNavigation={() => { setMobileOpen(false); }} />
    </div>
  );
}
