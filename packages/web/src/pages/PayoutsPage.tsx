import { useMemo, useState, type SyntheticEvent } from 'react';
import { money } from '../api.js';
import {
  LivelineChart,
  type LivelinePoint,
} from '../components/charts/LivelineChart.js';
import { ConfirmDialog } from '../components/common/ConfirmDialog.js';
import {
  IconExternal,
  IconRefresh,
  IconSettings,
  Spinner,
} from '../components/common/Icons.js';
import { InfoTooltip } from '../components/common/InfoTooltip.js';
import { PayoutsSkeleton } from '../components/common/Skeleton.js';
import { StatusBadge } from '../components/common/StatusBadge.js';
import { UserAvatar } from '../components/common/UserAvatar.js';
import { useAuth } from '../context/AuthContext.js';
import { useWorkspaceData } from '../context/WorkspaceDataContext.js';
import { useRouter } from '../router/Router.js';

function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}

export function PayoutsPage() {
  const { user } = useAuth();
  const {
    payouts,
    connectStatus,
    stats,
    initialLoading,
    refreshing,
    refreshAll,
    openBountyDetail,
    savePayoutEmail,
  } = useWorkspaceData();
  const { path, navigate } = useRouter();

  const isSettingsTab = normalizePath(path) === '/dashboard/payouts/settings';

  const [emailInput, setEmailInput] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const deliveredCents = payouts.reduce((acc, p) => acc + p.paidCents, 0);

  const payoutTelemetryPoints = useMemo<LivelinePoint[]>(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    const startSec = nowSec - Math.max(2, payouts.length + 1) * 60;
    const pts: LivelinePoint[] = [
      { time: startSec, value: 0, label: 'Init', sublabel: 'Baseline · $0.00' },
    ];
    let running = 0;
    payouts.forEach((p, idx) => {
      running += p.paidCents;
      pts.push({
        time: startSec + (idx + 1) * 60,
        value: running / 100,
        label: `#${String(p.issueNumber)}`,
        sublabel: `${p.repoFullName} #${String(p.issueNumber)} · @${p.login}`,
      });
    });
    return pts;
  }, [payouts]);

  const handlePrepareSave = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFormError('Enter a valid PayPal email address to receive disbursements.');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setFormError('');
    try {
      const updated = await savePayoutEmail(emailInput.trim().toLowerCase());
      setConfirmOpen(false);
      setEmailInput('');
      setFormSuccess(
        `PayPal destination saved (${updated.maskedEmail ?? 'encrypted'} · revision v${String(
          updated.connectionVersion ?? 1,
        )}).`,
      );
    } catch (err) {
      setConfirmOpen(false);
      setFormError(
        err instanceof Error
          ? err.message
          : 'Unable to save PayPal destination right now.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="c2-page">
      {/* Compact Header */}
      <header className="c2-page-head" data-tour={isSettingsTab ? 'payout-settings' : 'payouts'}>
        <div>
          {isSettingsTab ? (
            <>
              <h1 className="c2-page-title">
                Payout <span className="c2-title-muted">settings</span>
              </h1>
              <p className="c2-page-sub">
                Bind or rotate the encrypted PayPal destination tied to your GitHub account
              </p>
            </>
          ) : (
            <>
              <h1 className="c2-page-title">
                Payout <span className="c2-title-muted">disbursements</span>
              </h1>
              <p className="c2-page-sub">
                Automatic settlement ledger and pending contributor claims · Asia/Kolkata (IST)
              </p>
            </>
          )}
        </div>

        <div className="c2-head-controls">
          <div className="c2-segmented" role="tablist" aria-label="Payouts view">
            <button
              type="button"
              role="tab"
              aria-selected={!isSettingsTab}
              className={`c2-seg-btn ${!isSettingsTab ? 'is-active' : ''}`}
              onClick={() => {
                navigate('/dashboard/payouts');
              }}
            >
              Disbursements
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSettingsTab}
              className={`c2-seg-btn ${isSettingsTab ? 'is-active' : ''}`}
              onClick={() => {
                navigate('/dashboard/payouts/settings');
              }}
            >
              Payout Settings
            </button>
          </div>

          <button
            type="button"
            className="c2-btn c2-btn-secondary"
            onClick={refreshAll}
            disabled={refreshing || initialLoading}
            aria-label="Refresh"
          >
            {refreshing ? <Spinner size={14} /> : <IconRefresh size={14} />}
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {initialLoading ? (
        <PayoutsSkeleton />
      ) : isSettingsTab ? (
        /* ================= PAYOUT SETTINGS SUB-VIEW ================= */
        <div className="c2-grid-2">
          {/* Left Card: Current Destination Posture */}
          <section
            className="c2-card c2-card-divided"
            aria-label="Current payout connection"
          >
            <div className="c2-card-bar">
              <div className="c2-section-title-row">
                <h2 className="c2-card-title">Connected Identity</h2>
                <InfoTooltip text="Payouts are bound strictly to your authenticated GitHub user ID so no comment or third party can redirect your award." />
              </div>
              <span
                className={`c2-pill ${
                  connectStatus?.connected ? 'c2-pill-mint' : 'c2-pill-peach'
                }`}
              >
                {connectStatus?.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            <div className="c2-card-body">
              {user && (
                <div className="c2-identity-banner">
                  <UserAvatar login={user.login} size={40} />
                  <div>
                    <strong className="c2-identity-login">@{user.login}</strong>
                    <span className="c2-identity-sub">
                      GitHub ID #{user.id} · Verified OAuth session
                    </span>
                  </div>
                </div>
              )}

              <dl className="c2-kv-list">
                <div className="c2-kv-row">
                  <dt>
                    <span className="c2-th-info">
                      <span>Destination Email</span>
                      <InfoTooltip text="Raw emails are never returned by read APIs; only a masked preview is displayed." />
                    </span>
                  </dt>
                  <dd className="c2-tabular">
                    {connectStatus?.connected && connectStatus.maskedEmail
                      ? connectStatus.maskedEmail
                      : 'Not configured'}
                  </dd>
                </div>
                <div className="c2-kv-row">
                  <dt>
                    <span className="c2-th-info">
                      <span>Storage Protection</span>
                      <InfoTooltip text="Encrypted at rest with AES-256-GCM bound to your GitHub account ID and connection version." />
                    </span>
                  </dt>
                  <dd>
                    <span className="c2-pill c2-pill-neutral">AES-256-GCM</span>
                  </dd>
                </div>
                <div className="c2-kv-row">
                  <dt>Connection Revision</dt>
                  <dd className="c2-tabular">
                    {connectStatus?.connectionVersion
                      ? `v${String(connectStatus.connectionVersion)}`
                      : '—'}
                  </dd>
                </div>
                <div className="c2-kv-row">
                  <dt>Pending Claims</dt>
                  <dd>
                    {stats.awaitingClaimCount > 0
                      ? `${String(stats.awaitingClaimCount)} awaiting destination (${money(
                          stats.awaitingClaimCents,
                        )})`
                      : 'None waiting'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="c2-card-foot">
              <span>Account-bound payout safeguard</span>
              <span>PayPal Sandbox</span>
            </div>
          </section>

          {/* Right Card: Update / Connect Form */}
          <section
            className="c2-card c2-card-divided"
            aria-label="Update PayPal destination"
          >
            <div className="c2-card-bar">
              <div className="c2-section-title-row">
                <h2 className="c2-card-title">
                  {connectStatus?.connected
                    ? 'Update PayPal Destination'
                    : 'Connect PayPal Destination'}
                </h2>
                <InfoTooltip text="Saving a destination automatically resumes any committed awards waiting in Awaiting Claim." />
              </div>
              <IconSettings size={16} className="c2-text-muted" />
            </div>

            <div className="c2-card-body">
              <p className="c2-card-lead">
                Enter the PayPal email that should receive automatic USD disbursements when your qualifying pull requests merge.
              </p>

              {formError && (
                <div role="alert" className="c2-alert-banner" style={{ marginBottom: 14 }}>
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div
                  role="status"
                  className="c2-success-banner"
                  style={{ marginBottom: 14 }}
                >
                  <span>{formSuccess}</span>
                </div>
              )}

              <form
                onSubmit={handlePrepareSave}
                className="c2-settings-form"
                noValidate
              >
                <label htmlFor="paypal-email-input" className="c2-field-label">
                  PayPal recipient email
                </label>
                <input
                  id="paypal-email-input"
                  type="email"
                  className="c2-input"
                  placeholder={
                    connectStatus?.maskedEmail
                      ? `Current: ${connectStatus.maskedEmail}`
                      : 'Enter PayPal email address'
                  }
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                  }}
                  autoComplete="email"
                  required
                />
                <span className="c2-field-hint">
                  In-flight transfers keep their existing recorded intent; new or pending-claim awards use the updated revision.
                </span>

                <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
                  <button
                    type="submit"
                    className="c2-btn c2-btn-primary"
                    disabled={saving}
                  >
                    {saving && <Spinner size={14} />}
                    <span>
                      {connectStatus?.connected
                        ? 'Update Destination'
                        : 'Connect Destination'}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            <div className="c2-card-foot">
              <span>CSRF-verified encrypted session mutation</span>
              <span>POST /api/connect</span>
            </div>
          </section>
        </div>
      ) : (
        /* ================= DISBURSEMENTS LEDGER VIEW ================= */
        <div className="c2-stack">
          {/* Compact 4-Card Shadcn Payout KPI Strip */}
          <section className="c2-kpi-grid-equal" aria-label="Payout summary">
            <div className="c2-kpi-card">
              <div className="c2-kpi-head">
                <span>Delivered Payouts</span>
                <InfoTooltip text="Confirmed USD transfers settled across your accessible payout records." />
              </div>
              <div className="c2-kpi-body">
                <span className="c2-kpi-val c2-tabular">
                  {money(deliveredCents)}
                </span>
                <span className="c2-pill c2-pill-mint">
                  {payouts.length} {payouts.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              <div className="c2-kpi-foot is-static">
                <span>Confirmed transfers</span>
                <span>USD</span>
              </div>
            </div>

            <div className="c2-kpi-card">
              <div className="c2-kpi-head">
                <span>Awaiting Claim</span>
                <InfoTooltip text="Committed contributor awards waiting for PayPal destination connection." />
              </div>
              <div className="c2-kpi-body">
                <span className="c2-kpi-val c2-tabular">
                  {money(stats.awaitingClaimCents)}
                </span>
                <span
                  className={`c2-pill ${
                    stats.awaitingClaimCount > 0 ? 'c2-pill-peach' : 'c2-pill-neutral'
                  }`}
                >
                  {stats.awaitingClaimCount} pending
                </span>
              </div>
              <div className="c2-kpi-foot is-static">
                <span>Reserved contributor pool</span>
                <span>Protected</span>
              </div>
            </div>

            <div className="c2-kpi-card">
              <div className="c2-kpi-head">
                <span>Open Funded Pool</span>
                <InfoTooltip text="Escrow currently locked on active bounties ready for qualifying PR merges." />
              </div>
              <div className="c2-kpi-body">
                <span className="c2-kpi-val c2-tabular">
                  {money(stats.activeEscrowCents)}
                </span>
                <span className="c2-pill c2-pill-mint">
                  {stats.fundedCount} active
                </span>
              </div>
              <button
                type="button"
                className="c2-kpi-foot"
                onClick={() => {
                  navigate('/dashboard/contributions?filter=FUNDED');
                }}
              >
                <span>View funded bounties</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>

            <div className="c2-kpi-card">
              <div className="c2-kpi-head">
                <span>PayPal Destination</span>
                <InfoTooltip text="Encrypted payout recipient bound to your authenticated GitHub account." />
              </div>
              <div className="c2-kpi-body">
                <span className="c2-kpi-val-sm c2-tabular">
                  {connectStatus?.connected
                    ? (connectStatus.maskedEmail ?? 'Encrypted')
                    : 'Not linked'}
                </span>
                <span
                  className={`c2-pill ${
                    connectStatus?.connected ? 'c2-pill-mint' : 'c2-pill-peach'
                  }`}
                >
                  {connectStatus?.connected
                    ? `v${String(connectStatus.connectionVersion ?? 1)}`
                    : 'Action'}
                </span>
              </div>
              <button
                type="button"
                className="c2-kpi-foot"
                onClick={() => {
                  navigate('/dashboard/payouts/settings');
                }}
              >
                <span>
                  {connectStatus?.connected ? 'Manage destination' : 'Connect PayPal'}
                </span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>

          {/* Paired Telemetry + Ledger Row */}
          <div className="c2-charts-row">
            {/* Live Settlement Stream Card */}
            <section
              className="c2-card c2-card-divided"
              aria-label="Settlement stream"
            >
              <div className="c2-card-bar">
                <div className="c2-section-title-row">
                  <h2 className="c2-card-title">Live Settlement Stream</h2>
                  <InfoTooltip text="Real-time 60fps Liveline feed of cumulative settled USD against active locked escrow." />
                </div>
                <span className="c2-pill c2-pill-neutral">IST Live</span>
              </div>

              <div className="c2-telemetry-strip">
                <div className="c2-telemetry-val-group">
                  <span className="c2-telemetry-val c2-tabular">
                    {money(deliveredCents)}
                  </span>
                  <span className="c2-muted-caption">
                    disbursed · {money(stats.activeEscrowCents)} locked in escrow
                  </span>
                </div>
              </div>

              <div className="c2-chart-pad">
                <LivelineChart
                  data={payoutTelemetryPoints}
                  value={deliveredCents / 100}
                  color="#16A34A"
                  badgeColor={deliveredCents > 0 ? '#16A34A' : '#52525B'}
                  height={196}
                  liveClock
                  windowSecs={60}
                  referenceLine={
                    stats.activeEscrowCents > 0
                      ? {
                          value: stats.activeEscrowCents / 100,
                          label: `Available Escrow ${money(stats.activeEscrowCents)}`,
                        }
                      : null
                  }
                  formatValue={(v) => money(Math.round(v * 100))}
                  formatAxis={(v) => `$${Math.round(v).toLocaleString('en-US')}`}
                  ariaLabel="Live settlement disbursements telemetry"
                />
              </div>
            </section>

            {/* Disbursement Ledger Card */}
            <section
              className="c2-card c2-card-divided"
              aria-label="Disbursement ledger"
            >
              <div className="c2-card-bar">
                <div className="c2-section-title-row">
                  <h2 className="c2-card-title">Disbursement Ledger</h2>
                  <InfoTooltip text="Immutable per-contributor payout items created after an award is committed." />
                </div>
                <span className="c2-pill c2-pill-neutral">
                  {payouts.length} {payouts.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {payouts.length === 0 ? (
                <div className="c2-card-body is-centered">
                  <div className="c2-empty-box">
                    <p className="c2-empty-title">No disbursements recorded yet</p>
                    <p className="c2-empty-desc">
                      When a qualifying pull request merges on a funded bounty, exact-cent contributor payouts are created and tracked here automatically.
                    </p>
                    {stats.fundedCount > 0 && (
                      <button
                        type="button"
                        className="c2-btn c2-btn-secondary c2-btn-xs"
                        style={{ marginTop: 10 }}
                        onClick={() => {
                          navigate('/dashboard/contributions?filter=FUNDED');
                        }}
                      >
                        Inspect {stats.fundedCount} active{' '}
                        {stats.fundedCount === 1 ? 'bounty' : 'bounties'} →
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="c2-table-wrap">
                  <table className="c2-table">
                    <thead>
                      <tr>
                        <th>Bounty</th>
                        <th>Recipient</th>
                        <th>Status</th>
                        <th className="is-right">Paid</th>
                        <th className="is-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((p) => (
                        <tr key={p.id} className="c2-tr">
                          <td>
                            <div className="c2-issue-meta">
                              <span className="c2-mono-id">#{p.issueNumber}</span>
                              <span className="c2-repo-chip">{p.repoFullName}</span>
                            </div>
                          </td>

                          <td>
                            <span className="c2-contrib-chip">
                              <UserAvatar login={p.login} size={18} />
                              <span>@{p.login}</span>
                            </span>
                          </td>

                          <td>
                            <StatusBadge status={p.status} />
                          </td>

                          <td className="is-right">
                            <span className="c2-amount-val c2-tabular">
                              {money(p.paidCents)}
                            </span>
                          </td>

                          <td className="is-right">
                            <div className="c2-row-actions">
                              <button
                                type="button"
                                className="c2-btn c2-btn-secondary c2-btn-xs"
                                onClick={() => {
                                  openBountyDetail(p.bountyId);
                                }}
                              >
                                Inspect
                              </button>
                              <a
                                href={p.githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="c2-icon-btn"
                                aria-label={`Open ${p.repoFullName} #${String(
                                  p.issueNumber,
                                )} on GitHub`}
                              >
                                <IconExternal size={14} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="c2-card-foot">
                <span>Idempotent PayPal Payouts adapter</span>
                <span>Integer-cent precision</span>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for PayPal Destination Save */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm PayPal payout destination"
        description={
          <div style={{ display: 'grid', gap: 10 }}>
            <p style={{ margin: 0 }}>
              Bind <strong>{emailInput.trim().toLowerCase()}</strong> to{' '}
              <strong>@{user?.login}</strong> for automatic bounty disbursements?
            </p>
            <p style={{ margin: 0, color: '#6F767E', fontSize: 13 }}>
              Your email will be encrypted at rest with AES-256-GCM. Any committed awards waiting in Awaiting Claim will resume automatically.
            </p>
          </div>
        }
        confirmLabel="Confirm & Save"
        cancelLabel="Cancel"
        busy={saving}
        onConfirm={() => {
          void handleConfirmSave();
        }}
        onCancel={() => {
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}
