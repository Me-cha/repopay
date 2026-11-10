import { useEffect, useId, useRef } from 'react';
import { formatDateTimeIST, label, money } from '../../api.js';
import { useWorkspaceData } from '../../context/WorkspaceDataContext.js';
import { useRouter } from '../../router/Router.js';
import { SplitDonutChart, type DonutSlice } from '../charts/SplitDonutChart.js';
import { IconClose, IconExternal, Spinner } from '../common/Icons.js';
import { InfoTooltip } from '../common/InfoTooltip.js';
import { ModalDetailSkeleton } from '../common/Skeleton.js';
import {
  describeEscrowState,
  formatAttentionReason,
  StatusBadge,
} from '../common/StatusBadge.js';

export function BountyDetailModal() {
  const {
    selectedBountyId,
    selectedBountySummary,
    selectedDetail,
    detailLoading,
    detailError,
    openBountyDetail,
    closeBountyDetail,
  } = useWorkspaceData();
  const { navigate } = useRouter();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const isOpen = Boolean(selectedBountyId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!isOpen && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const base = selectedDetail ?? selectedBountySummary;
  const escrowState = base ? describeEscrowState(base) : null;
  const latestReview =
    selectedDetail?.verifications[0] ?? base?.latestReview ?? null;
  const attentionText = base
    ? formatAttentionReason(base.attentionReason, base.status)
    : null;

  // Build truthful allocation slices
  let donutTotal = 0;
  let donutCenterValue = '$0.00';
  let donutCenterLabel = 'Captured';
  let donutEmptyMessage = 'No escrow captured yet.';
  let slices: DonutSlice[] = [];

  if (base) {
    if (base.award && base.award.allocation.length > 0) {
      donutTotal = base.award.amountCents;
      donutCenterValue = money(base.award.amountCents,base.currency);
      donutCenterLabel = base.status === 'PAID' ? 'Settled' : 'Awarded';
      slices = base.award.allocation.map((a) => ({
        key: a.ghId,
        label: `@${a.login}`,
        githubLogin: a.login,
        cents: a.cents,
      }));
    } else if (
      base.status === 'FUNDED' ||
      base.status === 'NEEDS_REVIEW' ||
      base.status === 'PAYING'
    ) {
      donutTotal = base.amountCents;
      donutCenterValue = money(base.amountCents,base.currency);
      donutCenterLabel = 'In Escrow';
      slices = [
        {
          key: 'pool',
          label: 'Open Pool',
          cents: base.amountCents,
          color: '#2A9D5C',
        },
      ];
    } else if (base.status === 'CANCELLED') {
      donutTotal = 0;
      donutCenterValue = '$0.00';
      donutCenterLabel = 'Captured';
      donutEmptyMessage = base.fundedAt
        ? 'Bounty closed under cancellation workflow.'
        : `Draft (${money(base.amountCents,base.currency)} target) was cancelled before funding. No money moved.`;
    } else {
      donutTotal = 0;
      donutCenterValue = '$0.00';
      donutCenterLabel = 'Captured';
      donutEmptyMessage = `Unfunded draft (${money(base.amountCents,base.currency)} target). Maintainer funding locks escrow.`;
    }
  }

  const handleNextActionClick = (href: string) => {
    if (href === '/connect') {
      closeBountyDetail();
      navigate('/dashboard/payouts/settings');
      return;
    }
    if (href.startsWith('http://') || href.startsWith('https://')) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.href = href;
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      className="c2-detail-dialog"
      onCancel={(e) => {
        e.preventDefault();
        closeBountyDetail();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) closeBountyDetail();
      }}
    >
      <div className="c2-detail-inner">
        {/* Header */}
        <header className="c2-detail-header">
          <div>
            <div className="c2-detail-meta">
              <span>{base ? `${base.repoFullName} · Issue #${String(base.issueNumber)}` : `Bounty #${selectedBountyId ?? ''}`}</span>
              {base && <StatusBadge status={base.status} />}
              {detailLoading && (
                <span className="c2-inline-loading">
                  <Spinner size={13} />
                  <span>Syncing record…</span>
                </span>
              )}
            </div>
            <h2 id={headingId} className="c2-detail-title">
              {base?.title ?? 'Loading bounty record…'}
            </h2>
          </div>

          <button
            type="button"
            className="c2-icon-btn"
            onClick={closeBountyDetail}
            aria-label="Close inspection dialog"
          >
            <IconClose size={18} />
          </button>
        </header>

        {detailError && (
          <div role="alert" className="c2-alert-banner" style={{ marginTop: 14 }}>
            <span>{detailError}</span>
            {selectedBountyId && (
              <button
                type="button"
                className="c2-btn c2-btn-ghost c2-btn-sm"
                onClick={() => { openBountyDetail(selectedBountyId); }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {detailLoading && !selectedDetail ? (
          <ModalDetailSkeleton />
        ) : base && escrowState ? (
          <div className="c2-detail-body">
            {/* Truthful 3-Step Settlement Pipeline */}
            <section className="c2-pipeline-strip" aria-label="Settlement lifecycle state">
              <div className="c2-pipeline-node">
                <div className="c2-pipeline-label">
                  <span>1 · GitHub Issue</span>
                  <InfoTooltip text="Bounties originate on GitHub issues. Labels and comments never move money directly." />
                </div>
                <strong className="c2-pipeline-main">
                  {base.repoFullName} #{base.issueNumber}
                </strong>
                <span className="c2-pipeline-sub">
                  {base.fundedAt
                    ? `Funded ${formatDateTimeIST(base.fundedAt)}`
                    : 'Not funded yet'}
                </span>
              </div>

              <div className="c2-pipeline-node">
                <div className="c2-pipeline-label">
                  <span>2 · PR Verification</span>
                  <InfoTooltip text="Advisory exact-SHA review against frozen issue acceptance criteria and CI status." />
                </div>
                {latestReview ? (
                  <>
                    <strong className="c2-pipeline-main">
                      {latestReview.verdict
                        ? label(latestReview.verdict)
                        : label(latestReview.status)}
                      {latestReview.confidence !== null
                        ? ` · ${String(Math.round(latestReview.confidence * 100))}%`
                        : ''}
                    </strong>
                    <span className="c2-pipeline-sub">
                      Commit <code>{latestReview.headSha.slice(0, 7)}</code> ·{' '}
                      {formatDateTimeIST(latestReview.createdAt)}
                    </span>
                  </>
                ) : (
                  <>
                    <strong className="c2-pipeline-main c2-text-muted">
                      No PR verified yet
                    </strong>
                    <span className="c2-pipeline-sub">
                      Awaiting linked pull request submission
                    </span>
                  </>
                )}
              </div>

              <div className={`c2-pipeline-node is-tone-${escrowState.tone}`}>
                <div className="c2-pipeline-label">
                  <span>3 · Escrow Posture</span>
                  <InfoTooltip text="Funds are held in integer cents and released automatically upon qualifying PR merge." />
                </div>
                <strong className="c2-pipeline-main">
                  {money(base.amountCents,base.currency)} · {escrowState.headline}
                </strong>
                <span className="c2-pipeline-sub">{escrowState.detail}</span>
              </div>
            </section>

            {attentionText && (
              <div className="c2-attention-callout">
                <strong>Attention · </strong>
                <span>{attentionText}</span>
              </div>
            )}

            {/* Two-Column Inspection Grid */}
            <div className="c2-detail-cols">
              {/* Left: Criteria + Lifecycle Metadata + Activity */}
              <div className="c2-detail-card">
                <div className="c2-section-head">
                  <div className="c2-section-title-row">
                    <h3>Acceptance Criteria</h3>
                    <InfoTooltip text="Frozen when escrow is captured so requirements cannot shift mid-contribution." />
                  </div>
                  <span className="c2-pill c2-pill-neutral">
                    {base.fundedAt ? 'Frozen Spec' : 'Draft Spec'}
                  </span>
                </div>

                {selectedDetail?.criteria ? (
                  <pre className="c2-criteria-box">{selectedDetail.criteria}</pre>
                ) : (
                  <p className="c2-empty-inline">
                    {base.fundedAt
                      ? 'No additional criteria body recorded on this issue.'
                      : 'Criteria freeze occurs once the maintainer captures escrow funding.'}
                  </p>
                )}

                <dl className="c2-kv-list">
                  <div className="c2-kv-row">
                    <dt>Bounty Record</dt>
                    <dd>#{base.id} (Issue #{base.issueNumber})</dd>
                  </div>
                  <div className="c2-kv-row">
                    <dt>Target Amount</dt>
                    <dd className="c2-tabular">{money(base.amountCents,base.currency)}</dd>
                  </div>
                  <div className="c2-kv-row">
                    <dt>Funded Timestamp</dt>
                    <dd>{formatDateTimeIST(base.fundedAt)}</dd>
                  </div>
                  {base.cancellation && (
                    <div className="c2-kv-row">
                      <dt>Cancellation Notice</dt>
                      <dd>
                        {label(base.cancellation.stage)}. Notice does not mean money was refunded unless approved.
                      </dd>
                    </div>
                  )}
                </dl>

                {selectedDetail && selectedDetail.activity.length > 0 && (
                  <div className="c2-subblock">
                    <h4 className="c2-subhead">Audit Trail (IST)</h4>
                    <ul className="c2-audit-list">
                      {selectedDetail.activity.slice(0, 5).map((act) => (
                        <li key={act.id} className="c2-audit-item">
                          <span className="c2-audit-action">{label(act.action)}</span>
                          <span className="c2-audit-time">{formatDateTimeIST(act.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Right: Allocation Split Donut + Reviews + Actions */}
              <div className="c2-detail-card c2-detail-card-col">
                <div>
                  <div className="c2-section-head">
                    <div className="c2-section-title-row">
                      <h3>Allocation Split</h3>
                      <InfoTooltip text="Exact-cent distribution across confirmed contributors, or unallocated pool while open." />
                    </div>
                    {base.award ? (
                      <span className="c2-pill c2-pill-mint">
                        Paid {money(base.award.paidCents,base.currency)}
                      </span>
                    ) : null}
                  </div>

                  <SplitDonutChart currency={base.currency}
                    totalCents={donutTotal}
                    centerValue={donutCenterValue}
                    centerLabel={donutCenterLabel}
                    slices={slices}
                    emptyMessage={donutEmptyMessage}
                  />

                  {selectedDetail && selectedDetail.verifications.length > 0 && (
                    <div className="c2-subblock">
                      <h4 className="c2-subhead">Verification Runs</h4>
                      <ul className="c2-audit-list">
                        {selectedDetail.verifications.slice(0, 3).map((v) => (
                          <li key={v.id} className="c2-audit-item is-stacked">
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <strong>
                                <code>{v.headSha.slice(0, 7)}</code> ·{' '}
                                {v.verdict ? label(v.verdict) : label(v.status)}
                              </strong>
                              <span className="c2-audit-time">{formatDateTimeIST(v.createdAt)}</span>
                            </div>
                            {v.reasoning && <p className="c2-review-note">{v.reasoning}</p>}
                            {v.unmetRequirements.length > 0 && (
                              <ul className="c2-audit-list" aria-label="Unmet requirements">
                                {v.unmetRequirements.map((requirement) => (
                                  <li key={requirement} className="c2-audit-item">
                                    {requirement}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedDetail && selectedDetail.reviews.length > 0 && (
                    <div className="c2-subblock">
                      <h4 className="c2-subhead">Maintainer Decisions</h4>
                      <ul className="c2-audit-list">
                        {selectedDetail.reviews.map((r) => (
                          <li key={r.id} className="c2-audit-item is-stacked">
                            <strong>{label(r.kind)}</strong>
                            <p className="c2-review-note">{r.reason}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="c2-detail-actions">
                  <div className="c2-next-step-box">
                    <span className="c2-next-actor">Next step · {base.nextAction.actor}</span>
                    <span className="c2-next-desc">{base.nextAction.label}</span>
                  </div>

                  <div className="c2-action-btn-row">
                    <a
                      href={base.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="c2-btn c2-btn-primary"
                    >
                      <span>Open Issue #{base.issueNumber} on GitHub</span>
                      <IconExternal size={14} />
                    </a>

                    {base.nextAction.href &&
                      base.nextAction.href !== base.githubUrl && (
                        <button
                          type="button"
                          className="c2-btn c2-btn-secondary"
                          onClick={() => { handleNextActionClick(base.nextAction.href); }}
                        >
                          <span>{base.nextAction.label}</span>
                        </button>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
