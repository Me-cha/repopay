import { useMemo, useState } from 'react';
import { formatDateIST, label, money, type BountyDto } from '../api.js';
import {
  IconChevron,
  IconExternal,
  IconGitPullRequest,
  IconRefresh,
  IconSearch,
  Spinner,
} from '../components/common/Icons.js';
import { InfoTooltip } from '../components/common/InfoTooltip.js';
import { ContributionsSkeleton } from '../components/common/Skeleton.js';
import {
  formatAttentionReason,
  StatusBadge,
} from '../components/common/StatusBadge.js';
import { UserAvatar } from '../components/common/UserAvatar.js';
import { useWorkspaceData } from '../context/WorkspaceDataContext.js';
import { useRouter } from '../router/Router.js';

type FilterKey =
  | 'ALL'
  | 'FUNDED'
  | 'NEEDS_REVIEW'
  | 'OPEN'
  | 'AWAITING_CLAIM'
  | 'PAID'
  | 'CANCELLED';

type SortKey = 'priority' | 'amount' | 'issue';

function matchesFilter(b: BountyDto, filter: FilterKey): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'FUNDED':
      return b.status === 'FUNDED';
    case 'NEEDS_REVIEW':
      return b.needsAttention || b.status === 'NEEDS_REVIEW' || b.status === 'REFUNDING';
    case 'OPEN':
      return b.status === 'OPEN' || b.status === 'CAPTURING';
    case 'AWAITING_CLAIM':
      return b.status === 'AWAITING_CLAIM' || b.status === 'PAYING';
    case 'PAID':
      return b.status === 'PAID';
    case 'CANCELLED':
      return b.status === 'CANCELLED';
  }
}

export function ContributionsPage() {
  const {
    bounties,
    stats,
    initialLoading,
    refreshing,
    refreshAll,
    openBountyDetail,
  } = useWorkspaceData();
  const { search, navigate } = useRouter();

  const params = new URLSearchParams(search);
  const rawFilter = (params.get('filter') ?? 'ALL').toUpperCase();
  const activeFilter: FilterKey = (
    [
      'ALL',
      'FUNDED',
      'NEEDS_REVIEW',
      'OPEN',
      'AWAITING_CLAIM',
      'PAID',
      'CANCELLED',
    ] as FilterKey[]
  ).includes(rawFilter as FilterKey)
    ? (rawFilter as FilterKey)
    : 'ALL';

  const activeRepo = params.get('repo') ?? 'ALL';

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('priority');

  const updateUrlParams = (nextFilter: FilterKey, nextRepo: string) => {
    const next = new URLSearchParams();
    if (nextFilter !== 'ALL') next.set('filter', nextFilter);
    if (nextRepo !== 'ALL') next.set('repo', nextRepo);
    const qs = next.toString();
    navigate(`/dashboard/contributions${qs ? `?${qs}` : ''}`);
  };

  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: stats.totalCount },
    { key: 'FUNDED', label: 'Funded', count: stats.fundedCount },
    { key: 'NEEDS_REVIEW', label: 'Needs Review', count: stats.needsAttentionCount },
    { key: 'OPEN', label: 'Drafts', count: stats.openDraftCount },
    { key: 'AWAITING_CLAIM', label: 'Claiming', count: stats.awaitingClaimCount },
    { key: 'PAID', label: 'Settled', count: stats.paidCount },
    { key: 'CANCELLED', label: 'Cancelled', count: stats.cancelledCount },
  ];

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = bounties.filter((b) => {
      if (activeRepo !== 'ALL' && b.repoFullName !== activeRepo) return false;
      if (!matchesFilter(b, activeFilter)) return false;
      if (!q) return true;
      const inRepo = b.repoFullName.toLowerCase().includes(q);
      const inTitle = b.title.toLowerCase().includes(q);
      const inIssue =
        String(b.issueNumber).includes(q) || `#${String(b.issueNumber)}` === q;
      const inContributors =
        b.award?.allocation.some((a) => a.login.toLowerCase().includes(q)) ?? false;
      return inRepo || inTitle || inIssue || inContributors;
    });

    const rank = (b: BountyDto): number => {
      if (b.status === 'AWAITING_CLAIM' || b.status === 'NEEDS_REVIEW') return 0;
      if (b.status === 'FUNDED') return 1;
      if (b.needsAttention) return 2;
      if (b.status === 'OPEN') return 3;
      if (b.status === 'PAID') return 4;
      return 5;
    };

    return list.sort((a, b) => {
      if (sortBy === 'amount') return b.amountCents - a.amountCents;
      if (sortBy === 'issue') return b.issueNumber - a.issueNumber;
      return rank(a) - rank(b) || b.amountCents - a.amountCents;
    });
  }, [bounties, activeRepo, activeFilter, query, sortBy]);

  return (
    <div className="c2-page"><p>Summary totals show USD only; individual bounties show their payment currency.</p>
      {/* Compact Header */}
      <header className="c2-page-head" data-tour={activeFilter === 'NEEDS_REVIEW' ? 'needs-review' : 'contributions'}>
        <div>
          <h1 className="c2-page-title">
            Contribution <span className="c2-title-muted">management</span>
          </h1>
          <p className="c2-page-sub">
            Inspect bounty specifications, pull request verification runs, and escrow splits across repositories
          </p>
        </div>

        <div className="c2-head-controls">
          {stats.repositories.length > 0 && (
            <span className="c2-select-wrap">
              <select
                className="c2-select"
                aria-label="Filter by repository"
                value={activeRepo}
                onChange={(e) => {
                  updateUrlParams(activeFilter, e.target.value);
                }}
              >
                <option value="ALL">All repositories</option>
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

          <span className="c2-select-wrap">
            <select
              className="c2-select"
              aria-label="Sort contributions"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortKey);
              }}
            >
              <option value="priority">Sort: Action priority</option>
              <option value="amount">Sort: Highest value</option>
              <option value="issue">Sort: Newest issue #</option>
            </select>
            <IconChevron
              size={14}
              className="c2-select-chevron"
              aria-hidden="true"
            />
          </span>

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
        <ContributionsSkeleton />
      ) : (
        <div className="c2-stack">
          {/* Compact 4-Card Clickable Stage Summary Strip */}
          <div className="c2-kpi-grid-equal">
            <div
              className={`c2-kpi-card ${activeFilter === 'ALL' ? 'is-selected' : ''}`}
              onClick={() => {
                updateUrlParams('ALL', activeRepo);
              }}
            >
              <div className="c2-kpi-head">
                <span>All Bounties</span>
                <InfoTooltip text="Total accessible bounties across connected repositories." />
              </div>
              <div className="c2-kpi-body">
                <span className="c2-kpi-val c2-tabular">{stats.totalCount}</span>
                <span className="c2-pill c2-pill-neutral">
                  {money(stats.totalVolumeCents)}
                </span>
              </div>
              <div className="c2-kpi-foot is-static">
                <span>Pipeline scope</span>
                <span>{stats.repositories.length} repos</span>
              </div>
            </div>

            <div
              className={`c2-kpi-card ${activeFilter === 'FUNDED' ? 'is-selected' : ''}`}
              onClick={() => {
                updateUrlParams('FUNDED', activeRepo);
              }}
            >
              <div className="c2-kpi-head">
                <span>Funded Escrow</span>
                <InfoTooltip text="Captured PayPal funds locked for qualifying pull request merges." />
              </div>
              <div className="c2-kpi-body">
                <span className="c2-kpi-val c2-tabular">
                  {money(stats.activeEscrowCents)}
                </span>
                <span className="c2-pill c2-pill-mint">
                  {stats.fundedCount} active
                </span>
              </div>
              <div className="c2-kpi-foot is-static">
                <span>Protected in escrow</span>
                <span>→</span>
              </div>
            </div>

            <div
              className={`c2-kpi-card ${activeFilter === 'NEEDS_REVIEW' ? 'is-selected' : ''}`}
              onClick={() => {
                updateUrlParams('NEEDS_REVIEW', activeRepo);
              }}
            >
              <div className="c2-kpi-head">
                <span>Needs Review</span>
                <InfoTooltip text="Bounties with flagged sync/review states requiring maintainer inspection." />
              </div>
              <div className="c2-kpi-body">
                <span className="c2-kpi-val c2-tabular">
                  {stats.needsAttentionCount}
                </span>
                <span
                  className={`c2-pill ${
                    stats.needsAttentionCount > 0 ? 'c2-pill-peach' : 'c2-pill-neutral'
                  }`}
                >
                  {stats.needsAttentionCount > 0 ? 'Action needed' : 'Clear'}
                </span>
              </div>
              <div className="c2-kpi-foot is-static">
                <span>Maintainer queue</span>
                <span>→</span>
              </div>
            </div>

            <div
              className={`c2-kpi-card ${activeFilter === 'OPEN' ? 'is-selected' : ''}`}
              onClick={() => {
                updateUrlParams('OPEN', activeRepo);
              }}
            >
              <div className="c2-kpi-head">
                <span>Open Drafts</span>
                <InfoTooltip text="Issues drafted on GitHub awaiting initial maintainer escrow capture." />
              </div>
              <div className="c2-kpi-body">
                <span className="c2-kpi-val c2-tabular">{stats.openDraftCount}</span>
                <span className="c2-pill c2-pill-neutral">Unfunded</span>
              </div>
              <div className="c2-kpi-foot is-static">
                <span>Awaiting capture</span>
                <span>→</span>
              </div>
            </div>
          </div>

          {/* Shadcn Recent-Orders-Style Divided Table Card */}
          <section
            className="c2-card c2-card-divided"
            aria-label="Bounty and contribution records"
            data-tour="bounty-records"
          >
            <div className="c2-card-bar is-wrap">
              <div
                className="c2-filter-pills"
                role="tablist"
                aria-label="Filter by lifecycle stage"
              >
                {filterTabs.map((tab) => {
                  const isActive = activeFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`c2-filter-pill ${isActive ? 'is-active' : ''}`}
                      onClick={() => {
                        updateUrlParams(tab.key, activeRepo);
                      }}
                    >
                      <span>{tab.label}</span>
                      <span className="c2-filter-count">{tab.count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="c2-search-box">
                <IconSearch size={14} className="c2-search-icon" />
                <input
                  type="search"
                  className="c2-search-input"
                  placeholder="Filter repo, issue #, title, contributor…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                  }}
                  aria-label="Search contributions"
                />
                {query && (
                  <button
                    type="button"
                    className="c2-clear-btn"
                    onClick={() => {
                      setQuery('');
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="c2-card-body">
                <div className="c2-empty-box">
                  <p className="c2-empty-title">No matching contributions</p>
                  <p className="c2-empty-desc">
                    {bounties.length === 0
                      ? 'No bounties have been created on your accessible repositories yet.'
                      : 'No items match the selected stage, repository, or search filter.'}
                  </p>
                  {(activeFilter !== 'ALL' || activeRepo !== 'ALL' || query) && (
                    <button
                      type="button"
                      className="c2-btn c2-btn-secondary c2-btn-sm"
                      style={{ marginTop: 12 }}
                      onClick={() => {
                        setQuery('');
                        updateUrlParams('ALL', 'ALL');
                      }}
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="c2-table-wrap">
                <table className="c2-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Issue &amp; Repository</th>
                      <th>Stage</th>
                      <th>
                        <span className="c2-th-info">
                          <span>PR Verification</span>
                          <InfoTooltip text="Latest exact-SHA review outcome for linked pull requests." />
                        </span>
                      </th>
                      <th className="is-right">Escrow / Target</th>
                      <th className="is-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((b) => {
                      const note = formatAttentionReason(b.attentionReason, b.status);
                      const review = b.latestReview;
                      const isUnfundedCancelled =
                        b.status === 'CANCELLED' && !b.fundedAt;

                      return (
                        <tr key={b.id} className="c2-tr">
                          <td className="c2-td-id">
                            <span className="c2-mono-id">#{b.issueNumber}</span>
                          </td>

                          <td className="c2-td-main">
                            <div className="c2-issue-row-top">
                              <button
                                type="button"
                                className="c2-row-title-btn"
                                onClick={() => {
                                  openBountyDetail(b.id);
                                }}
                              >
                                {b.title}
                              </button>
                              <span className="c2-repo-chip">{b.repoFullName}</span>
                            </div>

                            {b.award && b.award.allocation.length > 0 ? (
                              <div className="c2-contrib-chips">
                                {b.award.allocation.map((alloc) => (
                                  <span key={alloc.ghId} className="c2-contrib-chip">
                                    <UserAvatar login={alloc.login} size={17} />
                                    <span>@{alloc.login}</span>
                                    <span className="c2-text-muted">
                                      {money(alloc.cents,b.currency)}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            ) : note ? (
                              <span className="c2-row-subnote">{note}</span>
                            ) : (
                              <span className="c2-row-subnote c2-text-muted">
                                {b.nextAction.actor}: {b.nextAction.label}
                              </span>
                            )}
                          </td>

                          <td>
                            <StatusBadge status={b.status} />
                          </td>

                          <td>
                            {review ? (
                              <div className="c2-verify-cell">
                                <span className="c2-verify-verdict">
                                  <IconGitPullRequest size={13} />
                                  <span>
                                    {review.verdict
                                      ? label(review.verdict)
                                      : label(review.status)}
                                  </span>
                                  {review.confidence !== null && (
                                    <strong>
                                      {Math.round(review.confidence * 100)}%
                                    </strong>
                                  )}
                                </span>
                                <span className="c2-verify-sha">
                                  <code>{review.headSha.slice(0, 7)}</code>
                                </span>
                              </div>
                            ) : isUnfundedCancelled ? (
                              <span className="c2-text-muted c2-small">
                                Closed before funding
                              </span>
                            ) : (
                              <span className="c2-text-muted c2-small">
                                No PR verified yet
                              </span>
                            )}
                          </td>

                          <td className="is-right">
                            <div className="c2-amount-cell">
                              <span
                                className={`c2-amount-val c2-tabular ${
                                  isUnfundedCancelled ? 'is-struck' : ''
                                }`}
                              >
                                {money(b.amountCents,b.currency)}
                              </span>
                              <span className="c2-amount-sub">
                                {b.fundedAt
                                  ? `Funded ${formatDateIST(b.fundedAt)}`
                                  : isUnfundedCancelled
                                    ? 'No funds captured'
                                    : 'Unfunded target'}
                              </span>
                            </div>
                          </td>

                          <td className="is-right">
                            <div className="c2-row-actions">
                              <button
                                type="button"
                                className="c2-btn c2-btn-secondary c2-btn-xs"
                                onClick={() => {
                                  openBountyDetail(b.id);
                                }}
                              >
                                Inspect
                              </button>
                              <a
                                href={b.githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="c2-icon-btn"
                                title={`Open Issue #${String(b.issueNumber)} on GitHub`}
                                aria-label={`Open Issue #${String(b.issueNumber)} on GitHub`}
                              >
                                <IconExternal size={14} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="c2-card-foot">
              <span>
                Showing {filteredRows.length} of {stats.totalCount} records
              </span>
              <span>Click any row title or Inspect to view frozen criteria &amp; split</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
