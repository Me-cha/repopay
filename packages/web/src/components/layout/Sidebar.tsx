import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspaceData } from '../../context/WorkspaceDataContext.js';
import { useRouter } from '../../router/Router.js';
import { ConfirmDialog } from '../common/ConfirmDialog.js';
import {
  BrandEmblem,
  IconChevron,
  IconClose,
  IconContributions,
  IconDashboardGrid,
  IconPayouts,
  IconSignOut,
} from '../common/Icons.js';
import { Skeleton } from '../common/Skeleton.js';
import { UserAvatar } from '../common/UserAvatar.js';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const { user } = useAuth();
  const { stats, payouts, connectStatus, initialLoading } = useWorkspaceData();
  const { path, search, navigate } = useRouter();

  const cleanPath = normalizePath(path);
  const currentFilter = (new URLSearchParams(search).get('filter') ?? 'ALL').toUpperCase();

  const onDashboard = cleanPath === '/dashboard';
  const onContributions = cleanPath === '/dashboard/contributions';
  const onPayoutsSection = cleanPath === '/dashboard/payouts' || cleanPath.startsWith('/dashboard/payouts/') || cleanPath === '/dashboard/wallet';
  const onPayoutSettings = cleanPath === '/dashboard/payouts/settings';

  const [contribOpen, setContribOpen] = useState(true);
  const [payoutsOpen, setPayoutsOpen] = useState(true);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Auto-expand active section when deep-linked
  useEffect(() => {
    if (onContributions) setContribOpen(true);
    if (onPayoutsSection) setPayoutsOpen(true);
  }, [onContributions, onPayoutsSection]);

  const go = (to: string) => {
    navigate(to);
    onCloseMobile?.();
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const csrf = user?.csrf ?? connectStatus?.csrf ?? '';
      await fetch('/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrf }).toString(),
      });
    } catch {
      // Fallback to GET /logout if needed
    } finally {
      window.location.href = '/';
    }
  };

  const renderCount = (count: number, tone: 'peach' | 'mint' | 'neutral') => {
    if (initialLoading) {
      return <Skeleton width={26} height={22} radius={7} />;
    }
    if (count <= 0) return null;
    return <span className={`c2-nav-count c2-nav-count-${tone}`}>{count}</span>;
  };

  const contributionSubItems = [
    {
      key: 'ALL',
      label: 'All Bounties',
      to: '/dashboard/contributions',
      active: onContributions && currentFilter === 'ALL',
      badge: renderCount(stats.totalCount, 'neutral'),
    },
    {
      key: 'FUNDED',
      label: 'Funded Escrow',
      to: '/dashboard/contributions?filter=FUNDED',
      active: onContributions && currentFilter === 'FUNDED',
      badge: renderCount(stats.fundedCount, 'mint'),
    },
    {
      key: 'NEEDS_REVIEW',
      label: 'Needs Review',
      to: '/dashboard/contributions?filter=NEEDS_REVIEW',
      active: onContributions && currentFilter === 'NEEDS_REVIEW',
      badge: renderCount(stats.needsAttentionCount, 'peach'),
    },
    {
      key: 'OPEN',
      label: 'Open Drafts',
      to: '/dashboard/contributions?filter=OPEN',
      active: onContributions && currentFilter === 'OPEN',
      badge: renderCount(stats.openDraftCount, 'neutral'),
    },
    {
      key: 'PAID',
      label: 'Settled',
      to: '/dashboard/contributions?filter=PAID',
      active: onContributions && currentFilter === 'PAID',
      badge: renderCount(stats.paidCount, 'mint'),
    },
  ];

  const payoutSubItems = [
    {
      key: 'wallet',
      label: 'PYUSD Wallet',
      to: '/dashboard/wallet',
      active: cleanPath === '/dashboard/wallet',
      badge: null,
    },
    {
      key: 'disbursements',
      label: 'Disbursements',
      to: '/dashboard/payouts',
      active: cleanPath === '/dashboard/payouts',
      badge:
        stats.awaitingClaimCount > 0
          ? renderCount(stats.awaitingClaimCount, 'peach')
          : renderCount(payouts.length, 'mint'),
    },
    {
      key: 'settings',
      label: 'Payout Settings',
      to: '/dashboard/payouts/settings',
      active: onPayoutSettings,
      badge: initialLoading ? (
        <Skeleton width={10} height={10} radius={5} />
      ) : (
        <span
          className={`c2-status-dot ${connectStatus?.connected ? 'is-connected' : 'is-unlinked'}`}
          title={connectStatus?.connected ? 'PayPal destination connected' : 'PayPal destination not set'}
        />
      ),
    },
  ];

  return (
    <>
      {mobileOpen && (
        <div
          className="c2-sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`c2-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}
        aria-label="Primary workspace navigation"
      >
        <div className="c2-sidebar-top">
          <div className="c2-sidebar-brand-row">
            <button
              type="button"
              className="c2-sidebar-brand"
              onClick={() => { go('/dashboard'); }}
              aria-label="Repopay Escrow Overview"
            >
              <BrandEmblem size={40} />
              <div className="c2-brand-copy">
                <span className="c2-brand-name">Repopay</span>
                <span className="c2-brand-tag">Escrow Desk</span>
              </div>
            </button>

            {mobileOpen && (
              <button
                type="button"
                className="c2-icon-btn c2-mobile-close"
                onClick={onCloseMobile}
                aria-label="Close navigation"
              >
                <IconClose size={18} />
              </button>
            )}
          </div>

          <nav className="c2-nav-stack">
            {/* Page 1: Dashboard Analytics */}
            <a
              href="/dashboard"
              className={`c2-nav-item ${onDashboard ? 'is-active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                go('/dashboard');
              }}
              aria-current={onDashboard ? 'page' : undefined}
            >
              <span className="c2-nav-left">
                <IconDashboardGrid size={20} />
                <span>Dashboard</span>
              </span>
            </a>

            {/* Page 2: Contribution Management (Core 2.0 expandable tree) */}
            <div className="c2-nav-group">
              <button
                type="button"
                className={`c2-nav-item c2-nav-parent ${onContributions ? 'is-parent-active' : ''}`}
                onClick={() => {
                  if (!onContributions) {
                    setContribOpen(true);
                    go('/dashboard/contributions');
                  } else {
                    setContribOpen((v) => !v);
                  }
                }}
                aria-expanded={contribOpen}
              >
                <span className="c2-nav-left">
                  <IconContributions size={20} />
                  <span>Contributions</span>
                </span>
                <IconChevron size={16} open={contribOpen} />
              </button>

              {contribOpen && (
                <ul className="c2-tree-list" role="list">
                  {contributionSubItems.map((sub, idx) => (
                    <li
                      key={sub.key}
                      className={`c2-tree-node ${idx === contributionSubItems.length - 1 ? 'is-last' : ''}`}
                    >
                      <span className="c2-tree-elbow" aria-hidden="true" />
                      <a
                        href={sub.to}
                        className={`c2-tree-link ${sub.active ? 'is-active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          go(sub.to);
                        }}
                        aria-current={sub.active ? 'page' : undefined}
                      >
                        <span className="c2-tree-label">{sub.label}</span>
                        {sub.badge}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Page 3: Payouts & Payout Settings (Core 2.0 expandable tree) */}
            <div className="c2-nav-group">
              <button
                type="button"
                className={`c2-nav-item c2-nav-parent ${onPayoutsSection ? 'is-parent-active' : ''}`}
                onClick={() => {
                  if (!onPayoutsSection) {
                    setPayoutsOpen(true);
                    go('/dashboard/payouts');
                  } else {
                    setPayoutsOpen((v) => !v);
                  }
                }}
                aria-expanded={payoutsOpen}
              >
                <span className="c2-nav-left">
                  <IconPayouts size={20} />
                  <span>Payouts</span>
                </span>
                <IconChevron size={16} open={payoutsOpen} />
              </button>

              {payoutsOpen && (
                <ul className="c2-tree-list" role="list">
                  {payoutSubItems.map((sub, idx) => (
                    <li
                      key={sub.key}
                      className={`c2-tree-node ${idx === payoutSubItems.length - 1 ? 'is-last' : ''}`}
                    >
                      <span className="c2-tree-elbow" aria-hidden="true" />
                      <a
                        href={sub.to}
                        className={`c2-tree-link ${sub.active ? 'is-active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          go(sub.to);
                        }}
                        aria-current={sub.active ? 'page' : undefined}
                      >
                        <span className="c2-tree-label">{sub.label}</span>
                        {sub.badge}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </nav>
        </div>

        {/* Bottom Authenticated Profile Pod */}
        <div className="c2-sidebar-footer">
          {user && (
            <div className="c2-account-pod">
              <div className="c2-account-user">
                <UserAvatar login={user.login} size={36} />
                <div className="c2-account-meta">
                  <span className="c2-account-login">@{user.login}</span>
                  <span className="c2-account-sub">
                    {initialLoading
                      ? 'Syncing profile…'
                      : connectStatus?.connected
                        ? connectStatus.maskedEmail ?? 'PayPal linked'
                        : 'PayPal not linked'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="c2-icon-btn"
                onClick={() => { setConfirmSignOut(true); }}
                title="Sign out"
                aria-label="Sign out"
              >
                <IconSignOut size={17} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out of Repopay?"
        description="Your active GitHub session cookie will be cleared on this browser. You can sign back in anytime via GitHub OAuth."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        busy={signingOut}
        onConfirm={() => {
          void handleSignOut();
        }}
        onCancel={() => { setConfirmSignOut(false); }}
      />
    </>
  );
}
