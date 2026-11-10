import { useState } from 'react';
import { money } from '../../api.js';
import { UserAvatar } from '../common/UserAvatar.js';

export interface DonutSlice {
  key: string;
  label: string;
  cents: number;
  count?: number;
  color?: string;
  githubLogin?: string;
}

const DEFAULT_PALETTE = ['#16A34A', '#18181B', '#D97706', '#71717A', '#A1A1AA'];

interface SplitDonutChartProps {
  currency?:string;
  totalCents: number;
  centerLabel?: string;
  centerValue?: string;
  slices: DonutSlice[];
  emptyMessage?: string;
  stacked?: boolean;
}

export function SplitDonutChart({
  currency='USD',
  totalCents,
  centerLabel = 'Total',
  centerValue,
  slices,
  emptyMessage = 'No escrow allocation locked yet',
  stacked = false,
}: SplitDonutChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const svgSize = stacked ? 152 : 138;
  const center = svgSize / 2;
  const radius = stacked ? 56 : 51;
  const strokeWidth = stacked ? 16 : 14;
  const circumference = 2 * Math.PI * radius;

  const nonZero = slices.filter((s) => s.cents > 0 || (s.count ?? 0) > 0);
  const metricTotal =
    totalCents > 0
      ? totalCents
      : nonZero.reduce((acc, s) => acc + (s.cents > 0 ? s.cents : s.count ?? 0), 0);

  let accumulated = 0;
  const gapPx = nonZero.length > 1 ? 2.5 : 0;

  const activeSlice = hoveredKey
    ? nonZero.find((s) => s.key === hoveredKey)
    : undefined;

  const displayVal = activeSlice
    ? money(activeSlice.cents,currency)
    : (centerValue ?? money(totalCents,currency));
  const displaySub = activeSlice ? activeSlice.label : centerLabel;

  return (
    <div className={`c2-donut-layout ${stacked ? 'is-stacked' : ''}`}>
      <div className="c2-donut-ring-box">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${String(svgSize)} ${String(svgSize)}`}
          role="img"
          aria-label={`${centerLabel}: ${centerValue ?? money(totalCents,currency)}`}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#F1F2F4"
            strokeWidth={strokeWidth}
          />
          {nonZero.map((slice, idx) => {
            const val = totalCents > 0 ? slice.cents : slice.count ?? 0;
            const pct = metricTotal > 0 ? val / metricTotal : 0;
            const rawDash = pct * circumference;
            const dash = Math.max(0, rawDash - gapPx);
            const offset = circumference * (1 - accumulated);
            accumulated += pct;
            const color =
              slice.color ??
              DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length] ??
              '#18181B';
            const isDimmed = hoveredKey !== null && hoveredKey !== slice.key;

            return (
              <circle
                key={slice.key}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={hoveredKey === slice.key ? strokeWidth + 2 : strokeWidth}
                strokeDasharray={`${String(dash)} ${String(circumference - dash)}`}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${String(center)} ${String(center)})`}
                opacity={isDimmed ? 0.42 : 1}
                style={{ cursor: 'pointer', transition: 'opacity 140ms ease' }}
                onMouseEnter={() => {
                  setHoveredKey(slice.key);
                }}
                onMouseLeave={() => {
                  setHoveredKey(null);
                }}
              />
            );
          })}
          <text
            x={center}
            y={center - 3}
            textAnchor="middle"
            className="c2-donut-val"
          >
            {displayVal}
          </text>
          <text
            x={center}
            y={center + 14}
            textAnchor="middle"
            className="c2-donut-sub"
          >
            {displaySub.length > 14 ? `${displaySub.slice(0, 13)}…` : displaySub}
          </text>
        </svg>
      </div>

      <div className="c2-donut-legend">
        {slices.length === 0 || metricTotal === 0 ? (
          <p className="c2-muted-note">{emptyMessage}</p>
        ) : (
          slices.map((slice, idx) => {
            const val = totalCents > 0 ? slice.cents : slice.count ?? 0;
            const pct = metricTotal > 0 ? Math.round((val / metricTotal) * 100) : 0;
            const color =
              slice.color ??
              DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length] ??
              '#18181B';
            const isHovered = hoveredKey === slice.key;

            return (
              <div
                key={slice.key}
                className={`c2-legend-item ${isHovered ? 'is-hovered' : ''}`}
                onMouseEnter={() => {
                  setHoveredKey(slice.key);
                }}
                onMouseLeave={() => {
                  setHoveredKey(null);
                }}
              >
                <div className="c2-legend-left">
                  <span className="c2-legend-dot" style={{ background: color }} />
                  {slice.githubLogin && (
                    <UserAvatar login={slice.githubLogin} size={18} />
                  )}
                  <span className="c2-legend-label">
                    {slice.githubLogin ? `@${slice.githubLogin}` : slice.label}
                  </span>
                </div>
                <div className="c2-legend-right">
                  {slice.count !== undefined && (
                    <span className="c2-legend-count">{slice.count}</span>
                  )}
                  <span className="c2-legend-pct">{pct}%</span>
                  <span className="c2-legend-money">{money(slice.cents,currency)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
