import { useState } from 'react';
import { money } from '../../api.js';

export interface StageBarDatum {
  key: string;
  label: string;
  cents: number;
  count: number;
  color: string;
}

interface StageDistributionChartProps {
  data: StageBarDatum[];
  mode: 'cents' | 'count';
}

function niceCeil(maxVal: number, isCurrency: boolean): number {
  if (maxVal <= 0) return isCurrency ? 10000 : 4;
  const target = isCurrency ? maxVal / 100 : maxVal;
  const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
  const normalized = target / magnitude;
  let step: number;
  if (normalized <= 1.2) step = 1.2;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 4) step = 4;
  else if (normalized <= 5) step = 5;
  else if (normalized <= 8) step = 8;
  else step = 10;
  const result = Math.ceil(step * magnitude);
  const aligned = Math.max(4, Math.ceil(result / 4) * 4);
  return isCurrency ? aligned * 100 : aligned;
}

/**
 * Compact Shadcn UI Kit style rounded column chart with full-height background
 * pill tracks (eliminating visual voids on sparse stages) and crisp hover readout.
 */
export function StageDistributionChart({ data, mode }: StageDistributionChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const values = data.map((d) => (mode === 'cents' ? d.cents : d.count));
  const rawMax = Math.max(0, ...values);
  const topTick = niceCeil(rawMax, mode === 'cents');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(topTick * t));

  const svgW = 500;
  const svgH = 224;
  const padLeft = mode === 'cents' ? 46 : 30;
  const padRight = 10;
  const padTop = 22;
  const padBottom = 30;
  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBottom;

  const slotW = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.min(38, Math.max(20, slotW * 0.52));

  const hoveredItem = hovered ? data.find((d) => d.key === hovered) : undefined;

  return (
    <div className="c2-chart-wrap">
      {hoveredItem && (
        <div className="c2-chart-hover-pill" aria-live="polite">
          <span
            className="c2-legend-dot"
            style={{ background: hoveredItem.color }}
          />
          <strong>{hoveredItem.label}</strong>
          <span className="c2-tabular">{money(hoveredItem.cents)}</span>
          <span className="c2-text-muted">
            ({hoveredItem.count} {hoveredItem.count === 1 ? 'issue' : 'issues'})
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${String(svgW)} ${String(svgH)}`}
        className="c2-bar-svg"
        role="img"
        aria-label={`Escrow breakdown by ${mode === 'cents' ? 'USD volume' : 'bounty count'}`}
      >
        {/* Horizontal gridlines & Y ticks */}
        {ticks.map((tick, idx) => {
          const ratio = topTick > 0 ? tick / topTick : 0;
          const y = padTop + plotH * (1 - ratio);
          const tickLabel =
            mode === 'cents'
              ? `$${Math.round(tick / 100).toLocaleString('en-US')}`
              : String(tick);
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                x2={svgW - padRight}
                y1={y}
                y2={y}
                stroke={idx === 0 ? '#E4E4E7' : '#F2F3F5'}
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                className="c2-axis-tick"
              >
                {tickLabel}
              </text>
            </g>
          );
        })}

        {/* Rounded pill background tracks + active bars */}
        {data.map((d, idx) => {
          const val = mode === 'cents' ? d.cents : d.count;
          const ratio = topTick > 0 ? val / topTick : 0;
          const barH = val > 0 ? Math.max(8, ratio * plotH) : 0;
          const cx = padLeft + slotW * idx + slotW / 2;
          const x = cx - barW / 2;
          const y = padTop + plotH - barH;
          const isHovered = hovered === d.key;

          return (
            <g
              key={d.key}
              onMouseEnter={() => {
                setHovered(d.key);
              }}
              onMouseLeave={() => {
                setHovered(null);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Invisible hit target */}
              <rect
                x={padLeft + slotW * idx}
                y={padTop}
                width={slotW}
                height={plotH + padBottom}
                fill="transparent"
              />

              {/* Subtle full-height pill track (Shadcn column cadence) */}
              <rect
                x={x}
                y={padTop}
                width={barW}
                height={plotH}
                rx={8}
                fill={isHovered ? '#ECEEEF' : '#F6F7F9'}
              />

              {/* Active bar */}
              {barH > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={8}
                  fill={d.color}
                  opacity={hovered && !isHovered ? 0.5 : 1}
                  style={{ transition: 'opacity 140ms ease' }}
                />
              )}

              {/* Value label above active bar */}
              {val > 0 && (
                <text
                  x={cx}
                  y={Math.max(13, y - 6)}
                  textAnchor="middle"
                  className="c2-bar-val"
                  fill={isHovered ? '#18181B' : '#52525B'}
                >
                  {mode === 'cents' ? money(d.cents) : String(d.count)}
                </text>
              )}

              {/* X label */}
              <text
                x={cx}
                y={padTop + plotH + 19}
                textAnchor="middle"
                className="c2-axis-x"
                fill={isHovered ? '#18181B' : '#71717A'}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
