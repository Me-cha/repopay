import { useEffect, useMemo, useRef, useState } from 'react';

export interface LivelinePoint {
  time: number;
  value: number;
  label?: string;
  sublabel?: string;
}

export interface LivelineWindowOption {
  key: string;
  label: string;
}

export interface LivelineReferenceLine {
  value: number;
  label: string;
}

export interface LivelineChartProps {
  data: LivelinePoint[];
  value: number;
  color?: string;
  badgeColor?: string;
  height?: number;
  formatValue?: (val: number) => string;
  formatAxis?: (val: number) => string;
  momentum?: 'up' | 'down' | 'flat' | boolean;
  liveClock?: boolean;
  windowSecs?: number;
  windows?: LivelineWindowOption[];
  activeWindow?: string;
  onWindowChange?: (key: string) => void;
  referenceLine?: LivelineReferenceLine | null;
  ariaLabel?: string;
}

const IST_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function formatTimeIST(sec: number): string {
  return IST_TIME_FORMATTER.format(new Date(sec * 1000));
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(22, 163, 74, ${String(alpha)})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

/**
 * Computes Fritsch-Carlson monotone cubic tangents so interpolated curves
 * stay smooth at 60fps without overshooting real financial balances.
 */
function computeMonotoneTangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  const deltas: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = (xs[i + 1] ?? 0) - (xs[i] ?? 0);
    const dy = (ys[i + 1] ?? 0) - (ys[i] ?? 0);
    deltas.push(dx);
    slopes.push(dx > 1e-6 ? dy / dx : 0);
  }

  const m: number[] = new Array<number>(n).fill(0);
  m[0] = slopes[0] ?? 0;
  m[n - 1] = slopes[n - 2] ?? 0;

  for (let i = 1; i < n - 1; i++) {
    const s0 = slopes[i - 1] ?? 0;
    const s1 = slopes[i] ?? 0;
    if (s0 * s1 <= 0) {
      m[i] = 0;
    } else {
      const dx0 = deltas[i - 1] ?? 1;
      const dx1 = deltas[i] ?? 1;
      const common = dx0 + dx1;
      m[i] = (3 * common) / ((common + dx1) / s0 + (common + dx0) / s1);
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const s = slopes[i] ?? 0;
    if (Math.abs(s) < 1e-9) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = (m[i] ?? 0) / s;
      const b = (m[i + 1] ?? 0) / s;
      const hyp = Math.hypot(a, b);
      if (hyp > 3) {
        const scale = 3 / hyp;
        m[i] = scale * a * s;
        m[i + 1] = scale * b * s;
      }
    }
  }

  return m;
}

function sampleMonotoneSpline(
  xs: number[],
  ys: number[],
  tangents: number[],
  targetX: number,
): number {
  const n = xs.length;
  if (n === 0) return 0;
  const firstX = xs[0] ?? 0;
  const lastX = xs[n - 1] ?? 0;
  if (n === 1 || targetX <= firstX) return ys[0] ?? 0;
  if (targetX >= lastX) return ys[n - 1] ?? 0;

  let lo = 0;
  let hi = n - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const xMid = xs[mid] ?? 0;
    const xNext = xs[mid + 1] ?? 0;
    if (targetX < xMid) {
      hi = mid - 1;
    } else if (targetX > xNext) {
      lo = mid + 1;
    } else {
      lo = mid;
      break;
    }
  }

  const idx = Math.max(0, Math.min(n - 2, lo));
  const x0 = xs[idx] ?? 0;
  const x1 = xs[idx + 1] ?? 1;
  const h = x1 - x0;
  if (h <= 1e-6) return ys[idx] ?? 0;

  const t = (targetX - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return (
    h00 * (ys[idx] ?? 0) +
    h10 * h * (tangents[idx] ?? 0) +
    h01 * (ys[idx + 1] ?? 0) +
    h11 * h * (tangents[idx + 1] ?? 0)
  );
}

function drawRoundedPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  pointerLeft = false,
) {
  const radius = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  if (pointerLeft) {
    const tip = 4;
    ctx.moveTo(x - tip, y + h / 2);
    ctx.lineTo(x + 2, y + 3);
    ctx.arcTo(x + 4, y, x + w - radius, y, radius);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x + 4, y + h, radius);
    ctx.arcTo(x + 4, y + h, x + 2, y + h - 3, radius);
    ctx.closePath();
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

/**
 * Real-time 60fps <canvas> telemetry chart inspired by benji.org/liveline.
 * Features Fritsch-Carlson monotone splines, smooth value/axis lerp,
 * pulsing live head dot + momentum chevrons, right-axis value badge,
 * optional reference line, and interactive hover crosshair scrubbing.
 */
export function LivelineChart({
  data,
  value,
  color = '#16A34A',
  badgeColor,
  height = 212,
  formatValue = (v) => `$${v.toFixed(2)}`,
  formatAxis = (v) => `$${v.toFixed(0)}`,
  momentum = true,
  liveClock = false,
  windowSecs = 60,
  windows,
  activeWindow,
  onWindowChange,
  referenceLine = null,
  ariaLabel = 'Live telemetry chart',
}: LivelineChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState<number>(520);
  const [hoverX, setHoverX] = useState<number | null>(null);

  // Rolling live stream buffer anchored to truthful value updates
  const liveSamplesRef = useRef<{ time: number; value: number }[]>([]);
  const animStateRef = useRef<{
    displayValues: number[];
    displayLive: number;
    displayMin: number;
    displayMax: number;
    initialized: boolean;
  }>({
    displayValues: [],
    displayLive: value,
    displayMin: 0,
    displayMax: Math.max(10, value * 1.25),
    initialized: false,
  });

  const normalizedData = useMemo<LivelinePoint[]>(() => {
    if (data.length >= 2) return data;
    const now = Math.floor(Date.now() / 1000);
    if (data.length === 1) {
      const only = data[0] ?? { time: now, value };
      return [
        { time: only.time - 30, value: 0, label: 'Start' },
        only,
      ];
    }
    return [
      { time: now - 60, value: 0, label: 'Start' },
      { time: now, value, label: 'Current' },
    ];
  }, [data, value]);

  // Seed or update live rolling buffer when value or window changes
  useEffect(() => {
    if (!liveClock) return;
    const nowSec = Date.now() / 1000;
    const step = Math.max(2, windowSecs / 24);
    const basePoints: { time: number; value: number }[] = [];
    const histLen = normalizedData.length;

    for (let i = 24; i >= 0; i--) {
      const t = nowSec - i * step;
      // Map historical shape softly onto entry window, ending on exact live value
      const histIdx = Math.min(
        histLen - 1,
        Math.floor(((24 - i) / 24) * histLen),
      );
      const v = i === 0 ? value : (normalizedData[histIdx]?.value ?? value);
      basePoints.push({ time: t, value: v });
    }
    liveSamplesRef.current = basePoints;
  }, [liveClock, windowSecs, normalizedData, value]);

  // Observe parent container width
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  // Compute momentum direction
  const resolvedMomentum = useMemo<'up' | 'down' | 'flat'>(() => {
    if (typeof momentum === 'string') return momentum;
    if (!momentum) return 'flat';
    const first = normalizedData[0]?.value ?? value;
    if (value > first + 0.001) return 'up';
    if (value < first - 0.001) return 'down';
    return 'flat';
  }, [momentum, normalizedData, value]);

  // Main render & 60fps interpolation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.getContext !== 'function') return;
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
      return;
    }

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastTs = performance.now();

    const renderFrame = (nowMs: number) => {
      const dt = Math.min(0.06, Math.max(0.001, (nowMs - lastTs) / 1000));
      lastTs = nowMs;

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const targetW = Math.max(220, width);
      const targetH = height;

      if (canvas.width !== Math.round(targetW * dpr) || canvas.height !== Math.round(targetH * dpr)) {
        canvas.width = Math.round(targetW * dpr);
        canvas.height = Math.round(targetH * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, targetW, targetH);

      // Layout geometry matching benji.org/liveline
      const padLeft = 10;
      const axisLaneW = 68;
      const plotRight = targetW - axisLaneW;
      const liveHeadX = plotRight - 18;
      const padTop = 16;
      const padBottom = 26;
      const plotW = Math.max(80, liveHeadX - padLeft);
      const plotH = Math.max(60, targetH - padTop - padBottom);

      // Determine active target points
      const nowSec = Date.now() / 1000;
      let activePts: LivelinePoint[] = normalizedData;

      if (liveClock) {
        const buf = liveSamplesRef.current;
        const lastSample = buf[buf.length - 1];
        if (!lastSample || nowSec - lastSample.time >= 1) {
          buf.push({ time: nowSec, value });
          const cutoff = nowSec - windowSecs - 10;
          while (buf.length > 2 && (buf[0]?.time ?? 0) < cutoff) {
            buf.shift();
          }
        }
        activePts = [...buf, { time: nowSec, value }];
      }

      const sampleCount = 32;
      const targetSampled: number[] = [];
      if (liveClock) {
        const winStart = nowSec - windowSecs;
        const xs = activePts.map((p) => p.time);
        const ys = activePts.map((p) => p.value);
        const tang = computeMonotoneTangents(xs, ys);
        for (let i = 0; i < sampleCount; i++) {
          const t = winStart + (i / (sampleCount - 1)) * windowSecs;
          targetSampled.push(sampleMonotoneSpline(xs, ys, tang, t));
        }
      } else {
        const n = activePts.length;
        const xs = activePts.map((_, idx) => idx / Math.max(1, n - 1));
        const ys = activePts.map((p) => p.value);
        const tang = computeMonotoneTangents(xs, ys);
        for (let i = 0; i < sampleCount; i++) {
          const u = i / (sampleCount - 1);
          targetSampled.push(sampleMonotoneSpline(xs, ys, tang, u));
        }
      }

      // Compute nice Y bounds
      const refVal = referenceLine ? referenceLine.value : value;
      const rawMax = Math.max(value, refVal, ...targetSampled);
      const rawMin = Math.min(0, value, ...targetSampled);
      const targetMax = rawMax <= 0 ? 50 : rawMax * 1.22;
      const targetMin = rawMin < 0 ? rawMin * 1.1 : 0;

      const anim = animStateRef.current;
      const lerpRate = prefersReduced ? 1 : 1 - Math.pow(0.0015, dt);

      if (!anim.initialized || anim.displayValues.length !== sampleCount) {
        anim.displayValues = [...targetSampled];
        anim.displayLive = value;
        anim.displayMin = targetMin;
        anim.displayMax = targetMax;
        anim.initialized = true;
      } else {
        for (let i = 0; i < sampleCount; i++) {
          const cur = anim.displayValues[i] ?? 0;
          const tgt = targetSampled[i] ?? 0;
          anim.displayValues[i] = cur + (tgt - cur) * lerpRate;
        }
        anim.displayLive += (value - anim.displayLive) * lerpRate;
        anim.displayMin += (targetMin - anim.displayMin) * lerpRate;
        anim.displayMax += (targetMax - anim.displayMax) * lerpRate;
      }

      const ySpan = Math.max(1e-3, anim.displayMax - anim.displayMin);
      const toY = (v: number) =>
        padTop + plotH * (1 - (v - anim.displayMin) / ySpan);

      // 1. Horizontal dotted gridlines + right-aligned monospace Y ticks
      const tickSteps = 4;
      ctx.font = '500 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      for (let i = 0; i <= tickSteps; i++) {
        const ratio = i / tickSteps;
        const tickVal = anim.displayMin + ySpan * ratio;
        const y = padTop + plotH * (1 - ratio);

        ctx.save();
        if (i === 0) {
          ctx.strokeStyle = '#ECEEEF';
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = '#F0F1F3';
          ctx.lineWidth = 1;
          ctx.setLineDash([1.5, 3.5]);
        }
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(plotRight, y);
        ctx.stroke();
        ctx.restore();

        // Hide tick text if it would collide with the live value pill
        const liveY = toY(anim.displayLive);
        if (Math.abs(y - liveY) > 13) {
          ctx.fillStyle = '#9CA3AF';
          ctx.fillText(formatAxis(tickVal), targetW - 6, y);
        }
      }

      // 2. Optional fixed referenceLine (e.g. Locked Escrow threshold)
      if (referenceLine && Math.abs(referenceLine.value - anim.displayLive) > ySpan * 0.06) {
        const refY = toY(referenceLine.value);
        if (refY >= padTop && refY <= padTop + plotH) {
          ctx.save();
          ctx.strokeStyle = '#D4D4D8';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(padLeft, refY);
          ctx.lineTo(plotRight, refY);
          ctx.stroke();

          ctx.fillStyle = '#71717A';
          ctx.font = '600 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(referenceLine.label, padLeft + 4, refY - 3);
          ctx.restore();
        }
      }

      // 3. Build pixel coordinates for spline curve
      const pxXs: number[] = [];
      const pxYs: number[] = [];
      for (let i = 0; i < sampleCount; i++) {
        const x = padLeft + (i / (sampleCount - 1)) * plotW;
        const y = toY(anim.displayValues[i] ?? 0);
        pxXs.push(x);
        pxYs.push(y);
      }
      const pxTangents = computeMonotoneTangents(pxXs, pxYs);

      // 4. Vertical alpha fade under curve
      const fillGrad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
      fillGrad.addColorStop(0, hexToRgba(color, 0.13));
      fillGrad.addColorStop(1, hexToRgba(color, 0.0));

      ctx.save();
      ctx.beginPath();
      const denseSteps = Math.max(64, Math.floor(plotW / 3));
      for (let s = 0; s <= denseSteps; s++) {
        const x = padLeft + (s / denseSteps) * plotW;
        const y = sampleMonotoneSpline(pxXs, pxYs, pxTangents, x);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(liveHeadX, padTop + plotH);
      ctx.lineTo(padLeft, padTop + plotH);
      ctx.closePath();
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.restore();

      // 5. Stroke smooth monotone spline
      ctx.save();
      ctx.beginPath();
      for (let s = 0; s <= denseSteps; s++) {
        const x = padLeft + (s / denseSteps) * plotW;
        const y = sampleMonotoneSpline(pxXs, pxYs, pxTangents, x);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      // 6. Dashed horizontal current-value guide line across canvas
      const headY = toY(anim.displayLive);
      ctx.save();
      ctx.strokeStyle = hexToRgba(color, 0.42);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, headY);
      ctx.lineTo(plotRight + 2, headY);
      ctx.stroke();
      ctx.restore();

      // 7. Pulsing live dot + momentum indicator at leading edge
      const pulsePhase = prefersReduced ? 0.5 : (Math.sin(nowMs / 380) + 1) / 2;
      const haloR = 6.5 + pulsePhase * 3.2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(liveHeadX, headY, haloR, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, 0.22 - pulsePhase * 0.1);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(liveHeadX, headY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(liveHeadX, headY, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();

      // Momentum double-chevron between dot and value badge
      if (resolvedMomentum !== 'flat') {
        const chevX = liveHeadX + 10;
        const dir = resolvedMomentum === 'up' ? -1 : 1;
        ctx.save();
        ctx.strokeStyle = resolvedMomentum === 'up' ? '#16A34A' : '#DC2626';
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const offset of [-2, 2]) {
          ctx.beginPath();
          ctx.moveTo(chevX - 2.6, headY + offset - dir * 1.8);
          ctx.lineTo(chevX, headY + offset + dir * 1.4);
          ctx.lineTo(chevX + 2.6, headY + offset - dir * 1.8);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 8. Right-axis pointed live value badge (Liveline signature pill)
      const pillText = formatValue(anim.displayLive);
      ctx.save();
      ctx.font = '700 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      const textW = ctx.measureText(pillText).width;
      const pillW = Math.min(axisLaneW - 4, Math.max(46, textW + 14));
      const pillH = 20;
      const pillX = targetW - pillW - 2;
      const pillY = Math.max(4, Math.min(padTop + plotH - pillH + 6, headY - pillH / 2));
      const fillPill =
        badgeColor ??
        (resolvedMomentum === 'down'
          ? '#DC2626'
          : value > 0
            ? '#16A34A'
            : '#52525B');

      drawRoundedPill(ctx, pillX, pillY, pillW, pillH, 10, true);
      ctx.fillStyle = fillPill;
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, pillX + pillW / 2, pillY + pillH / 2 + 0.5);
      ctx.restore();

      // 9. X-Axis labels (gliding IST clock in live mode, or bounty milestones in ledger mode)
      ctx.save();
      ctx.font = '500 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#9CA3AF';
      ctx.textBaseline = 'top';
      const xLabelY = padTop + plotH + 8;

      if (liveClock) {
        const intervalSec = windowSecs <= 60 ? 15 : 60;
        const winStart = nowSec - windowSecs;
        const firstTick = Math.ceil(winStart / intervalSec) * intervalSec;
        ctx.textAlign = 'center';
        for (let t = firstTick; t <= nowSec; t += intervalSec) {
          const x = padLeft + ((t - winStart) / windowSecs) * plotW;
          if (x > padLeft + 26 && x < liveHeadX - 24) {
            ctx.fillText(formatTimeIST(t), x, xLabelY);
          }
        }
      } else {
        const count = normalizedData.length;
        const maxTicks = Math.min(count, 5);
        for (let i = 0; i < maxTicks; i++) {
          const dataIdx =
            maxTicks === 1
              ? 0
              : Math.round((i / (maxTicks - 1)) * (count - 1));
          const pt = normalizedData[dataIdx];
          if (!pt) continue;
          const x =
            count <= 1
              ? padLeft
              : padLeft + (dataIdx / (count - 1)) * plotW;
          ctx.textAlign =
            i === 0 ? 'left' : i === maxTicks - 1 ? 'right' : 'center';
          const lbl = pt.label ?? formatTimeIST(pt.time);
          ctx.fillText(lbl, x, xLabelY);
        }
      }
      ctx.restore();

      // 10. Interactive Crosshair Hover Scrub
      if (hoverX !== null && hoverX >= padLeft && hoverX <= liveHeadX) {
        const clampedX = Math.max(padLeft, Math.min(liveHeadX, hoverX));
        const scrubY = sampleMonotoneSpline(pxXs, pxYs, pxTangents, clampedX);
        const normU = (clampedX - padLeft) / plotW;
        const scrubVal =
          anim.displayMin + (1 - (scrubY - padTop) / plotH) * ySpan;

        const scrubCaption = (() => {
          if (liveClock) {
            const scrubTime = nowSec - windowSecs + normU * windowSecs;
            return `${formatTimeIST(scrubTime)} IST · ${formatValue(Math.max(0, scrubVal))}`;
          }
          const nearIdx = Math.min(
            normalizedData.length - 1,
            Math.max(0, Math.round(normU * (normalizedData.length - 1))),
          );
          const nearPt = normalizedData[nearIdx];
          const prefix = nearPt?.sublabel ?? nearPt?.label ?? 'Point';
          return `${prefix} · ${formatValue(nearPt ? nearPt.value : Math.max(0, scrubVal))}`;
        })();

        ctx.save();
        ctx.strokeStyle = '#D4D4D8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(clampedX, padTop);
        ctx.lineTo(clampedX, padTop + plotH);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(clampedX, scrubY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#18181B';
        ctx.stroke();

        // Top scrub readout pill
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        const capW = ctx.measureText(scrubCaption).width + 16;
        const capH = 22;
        const capX = Math.max(
          padLeft,
          Math.min(plotRight - capW, clampedX - capW / 2),
        );
        drawRoundedPill(ctx, capX, 2, capW, capH, 7, false);
        ctx.fillStyle = '#18181B';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(scrubCaption, capX + capW / 2, 13);
        ctx.restore();
      }

      ctx.restore();

      const needsMoreLerp =
        Math.abs(anim.displayLive - value) > 0.02 ||
        Math.abs(anim.displayMax - targetMax) > 0.05;

      if ((liveClock || needsMoreLerp) && !prefersReduced) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    width,
    height,
    normalizedData,
    value,
    color,
    badgeColor,
    formatValue,
    formatAxis,
    resolvedMomentum,
    liveClock,
    windowSecs,
    referenceLine,
    hoverX,
  ]);

  return (
    <div className="c2-liveline-root" ref={wrapRef}>
      {windows && windows.length > 0 && onWindowChange && (
        <div className="c2-liveline-windows" role="group" aria-label="Telemetry horizon">
          {windows.map((w) => {
            const active = activeWindow === w.key;
            return (
              <button
                key={w.key}
                type="button"
                className={`c2-liveline-win-btn ${active ? 'is-active' : ''}`}
                onClick={() => {
                  onWindowChange(w.key);
                }}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="c2-liveline-canvas"
        style={{ width: '100%', height: `${String(height)}px`, display: 'block' }}
        role="img"
        aria-label={ariaLabel}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoverX(e.clientX - rect.left);
        }}
        onMouseLeave={() => {
          setHoverX(null);
        }}
      />
    </div>
  );
}
