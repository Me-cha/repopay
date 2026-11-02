import type { CSSProperties } from 'react';
import { Spinner } from './Icons.js';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  className = '',
  style,
}: SkeletonProps) {
  return (
    <span
      className={`c2-skeleton ${className}`.trim()}
      style={{
        width: typeof width === 'number' ? `${String(width)}px` : width,
        height: typeof height === 'number' ? `${String(height)}px` : height,
        borderRadius: typeof radius === 'number' ? `${String(radius)}px` : radius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function AppShellSkeleton() {
  return (
    <div className="c2-shell" aria-busy="true" aria-label="Loading workspace">
      <aside className="c2-sidebar">
        <div className="c2-sidebar-brand">
          <Skeleton width={40} height={40} radius={12} />
          <Skeleton width={88} height={20} radius={6} />
        </div>
        <div className="c2-nav-stack" style={{ marginTop: 28 }}>
          <Skeleton height={42} radius={10} />
          <Skeleton height={42} radius={10} />
          <div style={{ paddingLeft: 32, display: 'grid', gap: 8 }}>
            <Skeleton height={34} radius={8} />
            <Skeleton height={34} radius={8} />
            <Skeleton height={34} radius={8} />
          </div>
          <Skeleton height={42} radius={10} />
        </div>
        <div className="c2-sidebar-footer">
          <Skeleton height={52} radius={12} />
        </div>
      </aside>
      <main className="c2-outlet">
        <div className="c2-page-head">
          <Skeleton width={210} height={26} radius={7} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Spinner size={15} />
            <Skeleton width={110} height={32} radius={9} />
          </div>
        </div>
        <DashboardSkeleton />
      </main>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="c2-stack" role="status" aria-label="Loading analytics">
      <span className="sr-only">Loading accessible repositories…</span>

      {/* 4-Card KPI Strip Skeleton */}
      <div className="c2-kpi-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="c2-kpi-card" style={{ padding: 16 }}>
            <Skeleton width="55%" height={14} radius={5} />
            <Skeleton width="68%" height={28} radius={7} style={{ marginTop: 16 }} />
            <Skeleton width="80%" height={14} radius={5} style={{ marginTop: 18 }} />
          </div>
        ))}
      </div>

      {/* 2-Card Chart Row Skeleton */}
      <div className="c2-charts-row">
        <div className="c2-card c2-card-divided" style={{ padding: 18 }}>
          <Skeleton width={180} height={18} radius={5} />
          <Skeleton height={212} radius={10} style={{ marginTop: 16 }} />
        </div>
        <div className="c2-card c2-card-divided" style={{ padding: 18 }}>
          <Skeleton width={160} height={18} radius={5} />
          <Skeleton height={212} radius={10} style={{ marginTop: 16 }} />
        </div>
      </div>

      {/* 3-Card Bento Row Skeleton */}
      <div className="c2-bento-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="c2-card c2-card-divided" style={{ padding: 18 }}>
            <Skeleton width="50%" height={16} radius={5} />
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              <Skeleton height={38} radius={8} />
              <Skeleton height={38} radius={8} />
              <Skeleton height={38} radius={8} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContributionsSkeleton() {
  return (
    <div className="c2-stack" role="status" aria-label="Loading contributions">
      <div className="c2-kpi-grid-equal">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="c2-kpi-card" style={{ padding: 16 }}>
            <Skeleton width="55%" height={14} radius={5} />
            <Skeleton width="50%" height={26} radius={6} style={{ marginTop: 14 }} />
          </div>
        ))}
      </div>
      <div className="c2-card c2-card-divided" style={{ padding: 18 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 14,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <Skeleton width={72} height={30} radius={8} />
            <Skeleton width={84} height={30} radius={8} />
            <Skeleton width={96} height={30} radius={8} />
          </div>
          <Skeleton width={240} height={32} radius={9} />
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="c2-skeleton-row">
              <div style={{ display: 'grid', gap: 6, flex: 2 }}>
                <Skeleton width="58%" height={15} radius={4} />
                <Skeleton width="36%" height={12} radius={4} />
              </div>
              <Skeleton width={84} height={22} radius={999} />
              <Skeleton width={76} height={18} radius={5} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PayoutsSkeleton() {
  return (
    <div className="c2-stack" role="status" aria-label="Loading payouts">
      <div className="c2-kpi-grid-equal">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="c2-kpi-card" style={{ padding: 16 }}>
            <Skeleton width="55%" height={14} radius={5} />
            <Skeleton width="62%" height={26} radius={6} style={{ marginTop: 14 }} />
          </div>
        ))}
      </div>
      <div className="c2-charts-row">
        <div className="c2-card c2-card-divided" style={{ padding: 18 }}>
          <Skeleton width={170} height={16} radius={5} />
          <Skeleton height={190} radius={10} style={{ marginTop: 16 }} />
        </div>
        <div className="c2-card c2-card-divided" style={{ padding: 18 }}>
          <Skeleton width={160} height={16} radius={5} />
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            <Skeleton height={40} radius={8} />
            <Skeleton height={40} radius={8} />
            <Skeleton height={40} radius={8} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModalDetailSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 18 }} role="status" aria-label="Loading bounty details">
      <div className="c2-pipeline-strip">
        <Skeleton height={86} radius={14} />
        <Skeleton height={86} radius={14} />
        <Skeleton height={86} radius={14} />
      </div>
      <div className="c2-detail-cols">
        <Skeleton height={240} radius={16} />
        <Skeleton height={240} radius={16} />
      </div>
    </div>
  );
}
