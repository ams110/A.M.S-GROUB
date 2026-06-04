"use client";

import { useEffect, useRef, useState } from "react";

// ── Live clock hook ──────────────────────────────────────────────────────────
export function useNow(tickMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

// ── Count-up animated number ───────────────────────────────────────────────────
export function CountUp({
  value,
  duration = 900,
  format,
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  const n = Math.round(display);
  return <span className={className}>{format ? format(n) : n.toLocaleString("he-IL")}</span>;
}

// ── Trend badge (▲ +12% / ▼ -5%) ───────────────────────────────────────────────
export function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0 && current <= 0) return null;
  const pct = previous <= 0 ? 100 : ((current - previous) / previous) * 100;
  const up = pct >= 0;
  const flat = Math.abs(pct) < 0.05;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
        flat
          ? "bg-white/10 text-white/60"
          : up
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-wine/25 text-rose-300"
      }`}
      title="לעומת התקופה הקודמת"
    >
      {flat ? "—" : up ? "▲" : "▼"} {Math.abs(pct).toFixed(flat ? 0 : 1)}%
    </span>
  );
}

// ── Sparkline (tiny SVG trend line) ─────────────────────────────────────────────
export function Sparkline({
  data,
  width = 96,
  height = 30,
  stroke = "#C9A227",
  fill = "rgba(201,162,39,0.18)",
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Bar chart (revenue per day) ─────────────────────────────────────────────────
export function BarChart({
  data,
  labels,
  height = 160,
  format,
}: {
  data: number[];
  labels?: string[];
  height?: number;
  format?: (n: number) => string;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 22));
        return (
          <div key={i} className="group flex flex-1 flex-col items-center justify-end gap-1">
            <div className="relative w-full">
              <div
                className="mx-auto w-full max-w-[26px] rounded-t-md bg-gold-gradient transition-all duration-500"
                style={{ height: h }}
              />
              {format && (
                <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-navy-dark px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                  {format(v)}
                </div>
              )}
            </div>
            {labels && <span className="text-[9px] text-white/40">{labels[i]}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Skeleton block ──────────────────────────────────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gradient-to-l from-black/5 via-black/10 to-black/5 ${className}`}
    />
  );
}
