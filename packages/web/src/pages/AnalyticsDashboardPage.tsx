import { useMemo, useState } from 'react';
import { formatDateIST, money } from '../api.js';
import {
  LivelineChart,
  type LivelinePoint,
  type LivelineWindowOption,
} from '../components/charts/LivelineChart.js';
import { SplitDonutChart, type DonutSlice } from '../components/charts/SplitDonutChart.js';
import {
  StageDistributionChart,
  type StageBarDatum,
} from '../components/charts/StageDistributionChart.js';
import {
  IconArrowUpRight,
  IconChevron,
  IconRefresh,
  Spinner,
} from '../components/common/Icons.js';
import { InfoTooltip } from '../components/common/InfoTooltip.js';
import { DashboardSkeleton } from '../components/common/Skeleton.js';
import { formatAttentionReason, StatusBadge } from '../components/common/StatusBadge.js';
import { useWorkspaceData } from '../context/WorkspaceDataContext.js';
import { useRouter } from '../router/Router.js';

const LOCKED_SET = new Set(['FUNDED', 'NEEDS_REVIEW', 'AWAITING_CLAIM', 'PAYING']);

const TELEMETRY_WINDOWS: LivelineWindowOption[] = [
  { key: '1m', label: '1m' },
  { key: '5m', label: '5m' },
  { key: 'ledger', label: 'Ledger' },
];

type TelemetrySeriesKey = 'escrow' | 'pipeline' | 'settled';

export function AnalyticsDashboardPage() {
  const {
    bounties,
    payouts,
    connectStatus,
    stats,
    initialLoading,
    refreshing,
    updatedAtIST,
    refreshAll,
    openBountyDetail,
  } = useWorkspaceData();
  const { navigate } = useRouter();

  const [repoScope, setRepoScope] = useState<string>('ALL');
  const [chartMode, setChartMode] = useState<'cents' | 'count'>('cents');
  const [activeSeries, setActiveSeries] = useState<TelemetrySeriesKey>('escrow');
  const [telemetryWindow, setTelemetryWindow] = useState<string>('1m');

  const scopedBounties = useMemo(
    () =>
      repoScope === 'ALL'
        ? bounties.filter(b=>b.currency==='USD')
        : bounties.filter((b) => b.currency==='USD'&&b.repoFullName === repoScope),
    [bounties, repoScope],
  );

  const scopedMetrics = useMemo(() => {
    let totalVolumeCents = 0;
    let activeEscrowCents = 0;
    let fundedCount = 0;
    let fundedCents = 0;
    let needsReviewCount = 0;
    let needsReviewCents = 0;
    let openDraftCount = 0;
    let openDraftCents = 0;
    let awaitingClaimCount = 0;
    let awaitingClaimCents = 0;
    let paidCount = 0;
    let paidCents = 0;
    let cancelledCount = 0;
    let cancelledCents = 0;

    for (const b of scopedBounties) {
      totalVolumeCents += b.amountCents;
      if (LOCKED_SET.has(b.status)) {
        activeEscrowCents += b.award ? b.award.unpaidCents : b.amountCents;
      }
      if (b.status === 'FUNDED') {
        fundedCount++;
        fundedCents += b.amountCents;
      } else if (b.status === 'NEEDS_REVIEW') {
        needsReviewCount++;
        needsReviewCents += b.amountCents;
      } else if (b.status === 'OPEN' || b.status === 'CAPTURING') {
        openDraftCount++;
        openDraftCents += b.amountCents;
      } else if (b.status === 'AWAITING_CLAIM' || b.status === 'PAYING') {
        awaitingClaimCount++;
        awaitingClaimCents += b.award?.unpaidCents ?? b.amountCents;
      } else if (b.status === 'PAID') {
        paidCount++;
        paidCents += b.award?.paidCents ?? b.amountCents;
      } else if (b.status === 'CANCELLED' || b.status === 'REFUNDING') {
        cancelledCount++;
        cancelledCents += b.amountCents;
      }
    }

    if (repoScope === 'ALL') {
      const delivered = payouts.filter(p=>p.currency!=='PYUSD').reduce((acc, p) => acc + p.paidCents, 0);
      if (delivered > paidCents) paidCents = delivered;
    }

    // Build chronological ledger points from real bounty records (in USD)
    const chronological = [...scopedBounties].sort(
      (a, b) => Number(a.id) - Number(b.id),
    );
    const nowSec = Math.floor(Date.now() / 1000);
    const startSec = nowSec - Math.max(2, chronological.length + 1) * 60;

    let runAll = 0;
    let runEscrow = 0;
    let runPaid = 0;

    const escrowPoints: LivelinePoint[] = [
      { time: startSec, value: 0, label: 'Init', sublabel: 'Baseline · $0.00' },
    ];
    const pipelinePoints: LivelinePoint[] = [
      { time: startSec, value: 0, label: 'Init', sublabel: 'Baseline · $0.00' },
    ];
    const settledPoints: LivelinePoint[] = [
      { time: startSec, value: 0, label: 'Init', sublabel: 'Baseline · $0.00' },
    ];

    chronological.forEach((item, idx) => {
      const parsedFunded = item.fundedAt ? Date.parse(item.fundedAt) : Number.NaN;
      const t = Number.isNaN(parsedFunded)
        ? startSec + (idx + 1) * 60
        : Math.floor(parsedFunded / 1000);

      runAll += item.amountCents;
      if (LOCKED_SET.has(item.status)) {
        runEscrow += item.award ? item.award.unpaidCents : item.amountCents;
      }
      if (item.status === 'PAID' || (item.award && item.award.paidCents > 0)) {
        runPaid += item.award?.paidCents ?? item.amountCents;
      }

      const shortLbl = `#${String(item.issueNumber)}`;
      const fullSub = `${item.repoFullName} #${String(item.issueNumber)}`;

      escrowPoints.push({
        time: t,
        value: runEscrow / 100,
        label: shortLbl,
        sublabel: fullSub,
      });
      pipelinePoints.push({
        time: t,
        value: runAll / 100,
        label: shortLbl,
        sublabel: fullSub,
      });
      settledPoints.push({
        time: t,
        value: runPaid / 100,
        label: shortLbl,
        sublabel: fullSub,
      });
    });

    const stageBars: StageBarDatum[] = [
      { key: 'FUNDED', label: 'Funded', cents: fundedCents, count: fundedCount, color: '#16A34A' },
      { key: 'REVIEW', label: 'Review', cents: needsReviewCents, count: needsReviewCount, color: '#D97706' },
      { key: 'OPEN', label: 'Drafts', cents: openDraftCents, count: openDraftCount, color: '#18181B' },
      { key: 'CLAIM', label: 'Claiming', cents: awaitingClaimCents, count: awaitingClaimCount, color: '#B45309' },
      { key: 'PAID', label: 'Settled', cents: paidCents, count: paidCount, color: '#15803D' },
      { key: 'CANCELLED', label: 'Cancelled', cents: cancelledCents, count: cancelledCount, color: '#A1A1AA' },
    ];

    const rawSlices = [
      {
        key: 'funded',
        label: 'Funded Escrow',
        cents: fundedCents + needsReviewCents,
        count: fundedCount + needsReviewCount,
        color: '#16A34A',
      },
      {
        key: 'drafts',
        label: 'Open Drafts',
        cents: openDraftCents,
        count: openDraftCount,
        color: '#18181B',
      },
      {
        key: 'settled',
        label: 'Settled & Claiming',
        cents: paidCents + awaitingClaimCents,
        count: paidCount + awaitingClaimCount,
        color: '#D97706',
      },
      {
        key: 'cancelled',
        label: 'Cancelled',
        cents: cancelledCents,
        count: cancelledCount,
        color: '#A1A1AA',
      },
    ];
    const shareSlices: DonutSlice[] = rawSlices.filter((s) => s.cents > 0 || s.count > 0);

    return {
      totalCount: scopedBounties.length,
      totalVolumeCents,
      activeEscrowCents,
      fundedCount,
      fundedCents,
      needsReviewCount,
      openDraftCount,
      openDraftCents,
      awaitingClaimCount,
      paidCount,
      paidCents,
      cancelledCents,
      escrowPoints,
      pipelinePoints,
      settledPoints,
      stageBars,
      shareSlices,
    };
  }, [scopedBounties, payouts, repoScope]);

  const actionableItems = useMemo(() => {
    const rank = (status: string, attention: boolean): number => {
      if (status === 'AWAITING_CLAIM' || status === 'NEEDS_REVIEW') return 0;
      if (status === 'FUNDED') return 1;
      if (attention) return 2;
      if (status === 'OPEN') return 3;
      if (status === 'PAID') return 4;
      return 5;
    };
    return [...scopedBounties]
      .sort(
        (a, b) =>
          rank(a.status, a.needsAttention) - rank(b.status, b.needsAttention) ||
          b.amountCents - a.amountCents,
      )
      .slice(0, 4);
  }, [scopedBounties]);

  const captureRatioPct =
    scopedMetrics.totalVolumeCents > 0
      ? Math.round(
          (scopedMetrics.activeEscrowCents / scopedMetrics.totalVolumeCents) * 100,
        )
      : 0;

  const activeTelemetry = useMemo(() => {
    if (activeSeries === 'pipeline') {
      return {
        title: 'Pipeline Volume',
        cents: scopedMetrics.totalVolumeCents,
        points: scopedMetrics.pipelinePoints,
        color: '#18181B',
        badgeColor: '#18181B',
        pillLabel: `${String(scopedMetrics.totalCount)} tracked`,
        pillTone: 'neutral' as const,
        reference:
          scopedMetrics.activeEscrowCents > 0
            ? {
                value: scopedMetrics.activeEscrowCents / 100,
                label: `Locked Escrow ${money(scopedMetrics.activeEscrowCents)}`,
              }
            : null,
      };
    }
    if (activeSeries === 'settled') {
      return {
        title: 'Settled Payouts',
        cents: scopedMetrics.paidCents,
        points: scopedMetrics.settledPoints,
        color: '#0F766E',
        badgeColor: scopedMetrics.paidCents > 0 ? '#16A34A' : '#52525B',
        pillLabel:
          scopedMetrics.paidCount > 0
            ? `${String(scopedMetrics.paidCount)} settled`
            : 'No settlements yet',
        pillTone: scopedMetrics.paidCount > 0 ? ('mint' as const) : ('neutral' as const),
        reference: null,
      };
    }
    return {
      title: 'Active Escrow',
      cents: scopedMetrics.activeEscrowCents,
      points: scopedMetrics.escrowPoints,
      color: '#16A34A',
      badgeColor: scopedMetrics.activeEscrowCents > 0 ? '#16A34A' : '#52525B',
      pillLabel:
        scopedMetrics.fundedCount > 0
          ? `${String(scopedMetrics.fundedCount)} locked in escrow`
          : '0 locked',
      pillTone: scopedMetrics.fundedCount > 0 ? ('mint' as const) : ('neutral' as const),
      reference: null,
    };
  }, [activeSeries, scopedMetrics]);

  return (
    <div className="c2-page"><p>Financial charts show USD only. <a href="/dashboard/contributions">View all currencies by bounty</a>.</p>
      {/* Compact Shadcn-style Page Header */}
      <header className="c2-page-head" data-tour="overview">
        <div>
          <h1 className="c2-page-title">
            Escrow <span className="c2-title-muted">overview</span>
          </h1>
          <p className="c2-page-sub">
            Live escrow telemetry, stage breakdown, and repository allocation · Asia/Kolkata (IST)
          </p>
        </div>

        <div className="c2-head-controls">
          {updatedAtIST && (
            <span className="c2-sync-stamp" title="Last synchronized in IST">
              <span className="c2-live-dot" aria-hidden="true" />
              <span>{updatedAtIST}</span>
            </span>
          )}

          {stats.repositories.length > 0 && (
            <span className="c2-select-wrap">
              <select
                className="c2-select"
                aria-label="Filter analytics by repository"
                value={repoScope}
                onChange={(e) => {
                  setRepoScope(e.target.value);
                }}
              >
                <option value="ALL">
                  All repositories ({stats.repositories.length})
                </option>
                {stats.repositories.map((r) => (
                  <option key={r.repoFullName} value={r.repoFullName}>
                    {r.repoFullName}
                  </option>
                ))}
              </select>
              <IconChevron
                size={14}
                className="c2-select-chevron"
                aria-hidden="true"
              />
            </span>
          )}

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
        <DashboardSkeleton />
      ) : (
        <div className="c2-stack">
          {/* Row 1: Compact 4-Card Shadcn UI Kit KPI Strip (Equal Height, Zero Dead Space) */}
          <section className="c2-kpi-grid" aria-label="Overview metrics">
            {/* Lead Posture Card */}
            <div className="c2-kpi-lead-card">
              <div className="c2-kpi-lead-top">
                <div className="c2-section-title-row">
                  <span className="c2-kpi-lead-title">Escrow Desk Posture</span>
                  <span className="c2-pill c2-pill-neutral">
                    {scopedMetrics.totalCount}{' '}
                    {scopedMetrics.totalCount === 1 ? 'bounty' : 'bounties'}
                  </span>
                </div>
                <span className="c2-kpi-lead-sub">
                  {stats.repositories.length > 0
                    ? `Tracking ${String(stats.repositories.length)} connected GitHub ${
                        stats.repositories.length === 1 ? 'repository' : 'repositories'
                      }`
                    : 'Connect a repository issue to lock escrow'}
                </span>
              </div>

              <div className="c2-kpi-lead-bottom">
                <div>
                  <div className="c2-kpi-val c2-tabular">
                    {money(scopedMetrics.activeEscrowCents)}
                  </div>
                  <div className="c2-kpi-lead-delta">
                    <span className="c2-text-positive">{captureRatioPct}%</span>{' '}
                    <span>locked of {money(scopedMetrics.totalVolumeCents)} pipeline</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="c2-btn c2-btn-secondary c2-btn-sm"
                  onClick={() => {
                    navigate('/dashboard/contributions');
                  }}
                >
                  Inspect Queue
                </button>
              </div>
            </div>

            {/* KPI 2: Active Escrow */}
            <div
              className={`c2-kpi-card ${activeSeries === 'escrow' ? 'is-selected' : ''}`}
              onClick={() => {
                setActiveSeries('escrow');
              }}
            >
              <div className="c2-kpi-head">
                <span>Active Escrow</span>
                <InfoTooltip text="Captured USD currently locked in escrow across active and pending-claim bounties." />
              </div>
              <div className="c2-kpi-body">
                <span className="c2-kpi-val c2-tabular">
                  {money(scopedMetrics.activeEscrowCents)}
                </span>
                <span
                  className={`c2-pill ${
                    scopedMetrics.fundedCount > 0 ? 'c2-pill-mint' : 'c2-pill-neutral'
                  }`}
                >
                  {scopedMetrics.fundedCount > 0 && <IconArrowUpRight size={11} />}
                  <span>{scopedMetrics.fundedCount} locked</span>
                </span>
              </div>
              <button
                type="button"
                className="c2-kpi-foot"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/dashboard/contributions?filter=FUNDED');
                }}
              >
                <span>View locked escrow</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>

            {/* KPI 3: Pipeline Volume */}
            <div
              className={`c2-kpi-card ${activeSeries === 'pipeline' ? 'is-selected' : ''}`}
              onClick={() => {
                setActiveSeries('pipeline');
              }}
            >
              <div className="c2-kpi-head">
                <span>Pipeline Volume</span>
                <InfoTooltip text="Combined target value across locked bounties, unfunded drafts, and closed records." />
              </div>
              <div className="c2-kpi-body">
                <span className="c2-kpi-val c2-tabular">
                  {money(scopedMetrics.totalVolumeCents)}
                </span>
                <span
                  className={`c2-pill ${
                    scopedMetrics.openDraftCount > 0
                      ? 'c2-pill-peach'
                      : 'c2-pill-neutral'
                  }`}
                >
                  {scopedMetrics.openDraftCount} drafts
                </span>
              </div>
              <button
                type="button"
                className="c2-kpi-foot"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/dashboard/contributions?filter=OPEN');
                }}
              >
                <span>Open drafts queue</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>

            {/* KPI 4: Settled Payouts */}
            <div
              className={`c2-kpi-card ${activeSeries === 'settled' ? 'is-selected' : ''}`}
              onClick={() => {
                setActiveSeries('settled');
              }}
            >
              <div className="c2-kpi-head">
                <span>Settled Payouts</span>
                <InfoTooltip text="Confirmed USD disbursements delivered to contributor PayPal accounts after qualifying PR merge." />
              </div>
              <div className="c2-kpi-body">
                <span className="c2-kpi-val c2-tabular">
                  {money(scopedMetrics.paidCents)}
                </span>
                {scopedMetrics.awaitingClaimCount > 0 ? (
                  <span className="c2-pill c2-pill-peach">
                    {scopedMetrics.awaitingClaimCount} claiming
                  </span>
                ) : connectStatus?.connected ? (
                  <span className="c2-pill c2-pill-mint">Ready</span>
                ) : (
                  <span className="c2-pill c2-pill-neutral">Unlinked</span>
                )}
              </div>
              <button
                type="button"
                className="c2-kpi-foot"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/dashboard/payouts/settings');
                }}
              >
                <span>Payout configuration</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>

          {/* Row 2: Paired Equal-Height Primary Chart Cards (Liveline + Stage Columns) */}
          <div className="c2-charts-row">
            {/* Left: Benji Liveline Real-Time Escrow Telemetry Card */}
            <section className="c2-card c2-card-divided" aria-label="Live escrow telemetry">
              <div className="c2-card-bar">
                <div className="c2-section-title-row">
                  <h2 className="c2-card-title">Live Escrow Telemetry</h2>
                  <InfoTooltip text="Real-time 60fps Liveline stream anchored to verified USD balances and IST clock ticks. Hover to scrub." />
                </div>

                <div className="c2-segmented" role="group" aria-label="Telemetry series">
                  <button
                    type="button"
                    className={`c2-seg-btn ${activeSeries === 'escrow' ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveSeries('escrow');
                    }}
                  >
                    Escrow
                  </button>
                  <button
                    type="button"
                    className={`c2-seg-btn ${activeSeries === 'pipeline' ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveSeries('pipeline');
                    }}
                  >
                    Pipeline
                  </button>
                  <button
                    type="button"
                    className={`c2-seg-btn ${activeSeries === 'settled' ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveSeries('settled');
                    }}
                  >
                    Settled
                  </button>
                </div>
              </div>

              <div className="c2-telemetry-strip">
                <div className="c2-telemetry-val-group">
                  <span className="c2-telemetry-val c2-tabular">
                    {money(activeTelemetry.cents)}
                  </span>
                  <span className={`c2-pill c2-pill-${activeTelemetry.pillTone}`}>
                    {activeTelemetry.pillLabel}
                  </span>
                </div>

                <div className="c2-liveline-windows" role="group" aria-label="Time window">
                  {TELEMETRY_WINDOWS.map((w) => (
                    <button
                      key={w.key}
                      type="button"
                      className={`c2-liveline-win-btn ${
                        telemetryWindow === w.key ? 'is-active' : ''
                      }`}
                      onClick={() => {
                        setTelemetryWindow(w.key);
                      }}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="c2-chart-pad">
                <LivelineChart
                  data={activeTelemetry.points}
                  value={activeTelemetry.cents / 100}
                  color={activeTelemetry.color}
                  badgeColor={activeTelemetry.badgeColor}
                  height={210}
                  liveClock={telemetryWindow !== 'ledger'}
                  windowSecs={telemetryWindow === '5m' ? 300 : 60}
                  referenceLine={activeTelemetry.reference}
                  formatValue={(v) => money(Math.round(v * 100))}
                  formatAxis={(v) => `$${Math.round(v).toLocaleString('en-US')}`}
                  ariaLabel={`${activeTelemetry.title} live telemetry`}
                />
              </div>
            </section>

            {/* Right: Shadcn Ecommerce-Style Stage Distribution Column Card */}
            <section className="c2-card c2-card-divided" aria-label="Lifecycle stage breakdown">
              <div className="c2-card-bar">
                <div className="c2-section-title-row">
                  <h2 className="c2-card-title">Lifecycle Breakdown</h2>
                  <InfoTooltip text="Distribution of USD volume or issue count across every settlement stage." />
                </div>

                <div className="c2-segmented" role="group" aria-label="Chart metric">
                  <button
                    type="button"
                    className={`c2-seg-btn ${chartMode === 'cents' ? 'is-active' : ''}`}
                    onClick={() => {
                      setChartMode('cents');
                    }}
                  >
                    USD
                  </button>
                  <button
                    type="button"
                    className={`c2-seg-btn ${chartMode === 'count' ? 'is-active' : ''}`}
                    onClick={() => {
                      setChartMode('count');
                    }}
                  >
                    Count
                  </button>
                </div>
              </div>

              <div className="c2-telemetry-strip">
                <div className="c2-inline-kpis">
                  <div className="c2-inline-kpi">
                    <span className="c2-inline-kpi-lbl">LOCKED</span>
                    <strong className="c2-tabular">
                      {money(scopedMetrics.activeEscrowCents)}
                    </strong>
                  </div>
                  <div className="c2-inline-kpi">
                    <span className="c2-inline-kpi-lbl">DRAFTS</span>
                    <strong className="c2-tabular">
                      {money(scopedMetrics.openDraftCents)}
                    </strong>
                  </div>
                  <div className="c2-inline-kpi">
                    <span className="c2-inline-kpi-lbl">CLOSED</span>
                    <strong className="c2-tabular">
                      {money(scopedMetrics.cancelledCents)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="c2-chart-pad">
                <StageDistributionChart data={scopedMetrics.stageBars} mode={chartMode} />
              </div>
            </section>
          </div>

          {/* Row 3: Aligned 3-Column Bento Grid (Repositories · Portfolio Share · Actionable Queue) */}
          <div className="c2-bento-3">
            {/* Col 1: Repositories (Shadcn Sales by Location compact progress list) */}
            <section className="c2-card c2-card-divided">
              <div className="c2-card-bar">
                <div className="c2-section-title-row">
                  <h2 className="c2-card-title">Repositories</h2>
                  <InfoTooltip text="Click any repository to filter its contribution records." />
                </div>
                <span className="c2-pill c2-pill-neutral">
                  {stats.repositories.length} connected
                </span>
              </div>

              <div className="c2-card-body">
                {stats.repositories.length === 0 ? (
                  <div className="c2-empty-box">
                    <p className="c2-empty-title">No repositories yet</p>
                    <p className="c2-empty-desc">
                      Add a bounty label or command on an installed GitHub repository issue to start tracking escrow.
                    </p>
                  </div>
                ) : (
                  <div className="c2-loc-list">
                    {stats.repositories.map((repo) => {
                      const ratioPct =
                        scopedMetrics.totalVolumeCents > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (repo.totalCents / scopedMetrics.totalVolumeCents) * 100,
                              ),
                            )
                          : 0;
                      return (
                        <button
                          key={repo.repoFullName}
                          type="button"
                          className="c2-loc-row"
                          onClick={() => {
                            navigate(
                              `/dashboard/contributions?repo=${encodeURIComponent(
                                repo.repoFullName,
                              )}`,
                            );
                          }}
                        >
                          <div className="c2-loc-head">
                            <div className="c2-loc-title-group">
                              <span className="c2-loc-name">{repo.repoFullName}</span>
                              {repo.fundedCount > 0 ? (
                                <span className="c2-pill c2-pill-mint">
                                  {repo.fundedCount} locked
                                </span>
                              ) : repo.attentionCount > 0 ? (
                                <span className="c2-pill c2-pill-peach">
                                  {repo.attentionCount} review
                                </span>
                              ) : (
                                <span className="c2-pill c2-pill-neutral">
                                  {repo.totalCount} issues
                                </span>
                              )}
                            </div>
                            <span className="c2-loc-val c2-tabular">
                              {money(repo.totalCents)}{' '}
                              <span className="c2-text-muted">({ratioPct}%)</span>
                            </span>
                          </div>

                          <div className="c2-loc-track">
                            <div
                              className="c2-loc-fill"
                              style={{ width: `${String(Math.max(6, ratioPct))}%` }}
                            />
                          </div>

                          <div className="c2-loc-sub">
                            <span>
                              {money(repo.fundedCents)} locked · {repo.totalCount}{' '}
                              {repo.totalCount === 1 ? 'bounty' : 'bounties'}
                            </span>
                            {repo.attentionCount > 0 && (
                              <span className="c2-attention-inline">
                                {repo.attentionCount} needs attention
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="c2-card-foot">
                <span>Locked across repos: {money(stats.activeEscrowCents)}</span>
                <button
                  type="button"
                  className="c2-inline-link"
                  onClick={() => {
                    navigate('/dashboard/contributions');
                  }}
                >
                  Filter repos →
                </button>
              </div>
            </section>

            {/* Col 2: Portfolio Share (Shadcn Store Visits by Source vertical stacked ring) */}
            <section className="c2-card c2-card-divided">
              <div className="c2-card-bar">
                <div className="c2-section-title-row">
                  <h2 className="c2-card-title">Portfolio Share</h2>
                  <InfoTooltip text="Exact-cent share across locked escrow, open drafts, settled awards, and closed records." />
                </div>
                <span className="c2-muted-caption">Exact-cent</span>
              </div>

              <div className="c2-card-body is-centered">
                <SplitDonutChart
                  stacked
                  totalCents={scopedMetrics.totalVolumeCents}
                  centerValue={money(scopedMetrics.totalVolumeCents)}
                  centerLabel="Pipeline"
                  slices={scopedMetrics.shareSlices}
                  emptyMessage="No bounty volume recorded yet."
                />
              </div>

              <div className="c2-card-foot">
                <span>Integer-cent reconciliation</span>
                <span className="c2-tabular">
                  {scopedMetrics.shareSlices.length}{' '}
                  {scopedMetrics.shareSlices.length === 1 ? 'segment' : 'segments'}
                </span>
              </div>
            </section>

            {/* Col 3: Actionable Bounties (Shadcn Recent Orders compact queue) */}
            <section className="c2-card c2-card-divided">
              <div className="c2-card-bar">
                <div className="c2-section-title-row">
                  <h2 className="c2-card-title">Actionable Bounties</h2>
                  <InfoTooltip text="Select any item to inspect frozen criteria, verification runs, and exact allocation split." />
                </div>
                <button
                  type="button"
                  className="c2-btn c2-btn-secondary c2-btn-xs"
                  onClick={() => {
                    navigate('/dashboard/contributions');
                  }}
                >
                  Manage All →
                </button>
              </div>

              <div className="c2-card-body">
                {actionableItems.length === 0 ? (
                  <div className="c2-empty-box">
                    <p className="c2-empty-title">No accessible bounties on this page</p>
                    <p className="c2-empty-desc">
                      Bounties from your accessible GitHub repositories will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="c2-mini-list">
                    {actionableItems.map((b) => {
                      const note = formatAttentionReason(b.attentionReason, b.status);
                      return (
                        <div key={b.id} className="c2-mini-row">
                          <div className="c2-mini-main">
                            <div className="c2-mini-meta">
                              <span className="c2-mono-id">#{b.issueNumber}</span>
                              <span>{b.repoFullName}</span>
                              {b.fundedAt && (
                                <span>· {formatDateIST(b.fundedAt)}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="c2-row-title-btn"
                              onClick={() => {
                                openBountyDetail(b.id);
                              }}
                            >
                              {b.title}
                            </button>
                            {note && <span className="c2-mini-note">{note}</span>}
                          </div>

                          <div className="c2-mini-right">
                            <span className="c2-mini-amount c2-tabular">
                              {money(b.amountCents)}
                            </span>
                            <StatusBadge status={b.status} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="c2-card-foot">
                <span>
                  Showing {actionableItems.length} of {scopedMetrics.totalCount} records
                </span>
                <button
                  type="button"
                  className="c2-inline-link"
                  onClick={() => {
                    navigate('/dashboard/contributions');
                  }}
                >
                  Open queue →
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
