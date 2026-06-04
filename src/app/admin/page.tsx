"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, ORDER_STATUS_HE } from "@/lib/format";

// ── Shape of the store.admin_ops_stats() payload ─────────────────────────────

type OpsStats = {
  generated_at: string;
  kpi: {
    revenue_paid: number;
    revenue_month: number;
    revenue_prev_month: number;
    profit_paid: number;
    cogs_paid: number;
    inventory_value: number;
    inventory_retail: number;
  };
  counts: {
    orders_total: number;
    orders_pending: number;
    orders_today: number;
    dealers_total: number;
    dealers_pending: number;
    products_total: number;
    products_low: number;
    quotes_pending: number;
  };
  orders_by_status: Record<string, number>;
  series: { day: string; revenue: number; orders: number; profit: number }[];
  top_products: { name: string; qty: number; revenue: number }[];
  recent_orders: {
    id: string;
    order_number: string;
    total: number;
    currency: string;
    status: string;
    payment_status: string;
    created_at: string;
    dealer: string | null;
  }[];
  low_stock: { name: string; stock: number; reorder: number }[];
};

const RANGES = [
  { days: 7, label: "7 ימים" },
  { days: 14, label: "14 יום" },
  { days: 30, label: "30 יום" },
];

// Compact currency (₪1.2M / ₪34K) for large headline figures.
function compactPrice(value: number, currency = "ILS") {
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return formatPrice(value, currency);
  }
}

// ── Mini SVG area + profit-line chart (no external deps) ──────────────────────

function TrendChart({ series }: { series: OpsStats["series"] }) {
  if (series.length === 0) return null;
  const W = 720;
  const H = 200;
  const pad = { t: 16, r: 8, b: 24, l: 8 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = Math.max(1, ...series.map((d) => Math.max(d.revenue, d.profit)));
  const n = series.length;
  const x = (i: number) => pad.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;

  const revLine = series.map((d, i) => `${x(i)},${y(d.revenue)}`).join(" ");
  const areaPath = `M ${x(0)},${y(series[0].revenue)} L ${revLine
    .split(" ")
    .slice(1)
    .join(" L ")} L ${x(n - 1)},${pad.t + innerH} L ${x(0)},${pad.t + innerH} Z`;
  const profitLine = series.map((d, i) => `${x(i)},${y(d.profit)}`).join(" ");

  const empty = series.every((d) => d.revenue === 0 && d.profit === 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E0BE45" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#E0BE45" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline grid */}
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={pad.l}
            x2={W - pad.r}
            y1={pad.t + innerH * (1 - g)}
            y2={pad.t + innerH * (1 - g)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}

        {!empty && (
          <>
            <path d={areaPath} fill="url(#revFill)" />
            <polyline
              points={revLine}
              fill="none"
              stroke="#E0BE45"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={profitLine}
              fill="none"
              stroke="#4ADE80"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {series.map((d, i) => (
              <circle key={i} cx={x(i)} cy={y(d.revenue)} r={2} fill="#E0BE45" />
            ))}
          </>
        )}
      </svg>

      {empty && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="text-sm text-white/40">אין נתוני מכירות לתקופה זו עדיין</p>
        </div>
      )}
    </div>
  );
}

// ── Status colour map for the order breakdown ─────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-sky-400",
  paid: "bg-emerald-400",
  shipped: "bg-indigo-400",
  delivered: "bg-emerald-500",
  cancelled: "bg-rose-400",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-sky-100 text-sky-700",
  paid: "bg-emerald-100 text-emerald-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

const QUICK_ACTIONS = [
  { href: "/admin/products/edit", label: "מוצר חדש", icon: "➕" },
  { href: "/admin/orders", label: "הזמנות", icon: "📦" },
  { href: "/admin/quotes", label: "הצעות מחיר", icon: "📝" },
  { href: "/admin/dealers", label: "לקוחות", icon: "👥" },
  { href: "/admin/inventory", label: "מלאי", icon: "🏷️" },
  { href: "/admin/purchase-orders", label: "רכש", icon: "🚚" },
];

export default function AdminOpsCenter() {
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async (range: number) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_ops_stats", { days: range });
    if (error) {
      setError(error.message);
    } else {
      setStats(data as OpsStats);
      setError(null);
    }
    setLoading(false);
  }, []);

  // initial + range change
  useEffect(() => {
    if (firstLoad.current) firstLoad.current = false;
    else setLoading(true);
    load(days);
  }, [days, load]);

  // silent auto-refresh every 60s (the live clock ticks in its own component)
  useEffect(() => {
    const poll = setInterval(() => load(days), 60_000);
    return () => clearInterval(poll);
  }, [days, load]);

  if (loading && !stats) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          טוען נתוני מערכת…
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card p-8 text-center">
        <p className="text-rose-600">לא ניתן לטעון את נתוני המערכת.</p>
        {error && <p className="mt-2 text-xs text-slate-400">{error}</p>}
        <button onClick={() => load(days)} className="btn-primary mt-4">
          נסה שוב
        </button>
      </div>
    );
  }

  const { kpi, counts, orders_by_status, series, top_products, recent_orders, low_stock } = stats;
  const margin = kpi.revenue_paid > 0 ? (kpi.profit_paid / kpi.revenue_paid) * 100 : 0;
  const momDelta =
    kpi.revenue_prev_month > 0
      ? ((kpi.revenue_month - kpi.revenue_prev_month) / kpi.revenue_prev_month) * 100
      : null;
  const statusEntries = Object.entries(orders_by_status).sort((a, b) => b[1] - a[1]);
  const statusTotal = statusEntries.reduce((s, [, c]) => s + c, 0);
  const peakRevenue = Math.max(0, ...series.map((d) => d.revenue));
  const maxQty = Math.max(1, ...top_products.map((p) => p.qty));

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* ── Command bar ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-onyx-gradient p-5 shadow-onyx sm:p-6">
        <span className="absolute inset-x-0 top-0 h-px hairline-gold" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow text-gold/80">מרכז שליטה</p>
            <h2 className="mt-1 flex items-center gap-2.5 text-2xl font-extrabold text-white">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              סקירת פעילות <span className="text-gradient-gold">חיה</span>
            </h2>
          </div>
          <LiveClock />
        </div>

        {/* range selector */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-white/40">טווח:</span>
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                days === r.days
                  ? "bg-gold-gradient text-navy-dark shadow-gold"
                  : "bg-white/8 text-white/55 hover:bg-white/14 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
          {loading && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          )}
        </div>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="הכנסות ששולמו"
          value={compactPrice(kpi.revenue_paid)}
          sub={`סה״כ ${counts.orders_total} הזמנות`}
          tone="gold"
          icon="💰"
        />
        <KpiCard
          label="רווח גולמי (אומדן)"
          value={compactPrice(kpi.profit_paid)}
          sub={`מרווח ${margin.toFixed(1)}%`}
          tone="emerald"
          icon="📈"
        />
        <KpiCard
          label="הכנסות החודש"
          value={compactPrice(kpi.revenue_month)}
          sub={
            momDelta == null
              ? "אין נתוני חודש קודם"
              : `${momDelta >= 0 ? "▲" : "▼"} ${Math.abs(momDelta).toFixed(0)}% מהחודש שעבר`
          }
          tone={momDelta == null ? "plain" : momDelta >= 0 ? "emerald" : "rose"}
          icon="🗓️"
        />
        <KpiCard
          label="שווי מלאי (מחירון)"
          value={compactPrice(kpi.inventory_retail)}
          sub={`${counts.products_total} מוצרים פעילים`}
          tone="plain"
          icon="📦"
        />
      </div>

      {/* ── Chart + side metrics ─────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Trend chart */}
        <div className="relative overflow-hidden rounded-3xl bg-onyx-gradient p-5 shadow-onyx lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white">מגמת מכירות ורווח</h3>
              <p className="text-xs text-white/40">{days} הימים האחרונים</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-white/60">
                <span className="h-2.5 w-2.5 rounded-full bg-gold" /> הכנסות
              </span>
              <span className="flex items-center gap-1.5 text-white/60">
                <span className="h-2.5 w-4 rounded-full bg-emerald-400" /> רווח
              </span>
            </div>
          </div>
          <TrendChart series={series} />
          <div className="mt-2 flex items-center justify-between text-xs text-white/40">
            <span>שיא יומי: {compactPrice(peakRevenue)}</span>
            <span>
              עודכן{" "}
              {new Date(stats.generated_at).toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* Live counters */}
        <div className="grid grid-cols-2 gap-3">
          <CounterTile
            href="/admin/dealers"
            label="סוחרים לאישור"
            value={counts.dealers_pending}
            alert={counts.dealers_pending > 0}
          />
          <CounterTile
            href="/admin/orders"
            label="הזמנות ממתינות"
            value={counts.orders_pending}
            alert={counts.orders_pending > 0}
          />
          <CounterTile
            href="/admin/quotes"
            label="הצעות פתוחות"
            value={counts.quotes_pending}
            alert={counts.quotes_pending > 0}
          />
          <CounterTile
            href="/admin/inventory"
            label="מלאי נמוך"
            value={counts.products_low}
            alert={counts.products_low > 0}
          />
          <CounterTile href="/admin/orders" label="הזמנות היום" value={counts.orders_today} />
          <CounterTile href="/admin/dealers" label="סוחרים פעילים" value={counts.dealers_total} />
        </div>
      </div>

      {/* ── Breakdown row ────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Order status breakdown */}
        <section className="card p-5">
          <h3 className="mb-3 font-bold text-navy-dark">פילוח הזמנות לפי סטטוס</h3>
          {statusTotal === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">אין הזמנות עדיין.</p>
          ) : (
            <ul className="space-y-2.5">
              {statusEntries.map(([status, c]) => (
                <li key={status}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status] ?? "bg-slate-300"}`} />
                      {ORDER_STATUS_HE[status] ?? status}
                    </span>
                    <span className="font-semibold text-navy-dark">{c}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${STATUS_DOT[status] ?? "bg-slate-300"}`}
                      style={{ width: `${(c / statusTotal) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top products */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-navy-dark">מוצרים מובילים</h3>
            <Link href="/admin/products" className="text-sm text-brand hover:underline">
              למוצרים
            </Link>
          </div>
          {top_products.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">אין מכירות עדיין.</p>
          ) : (
            <ul className="space-y-3">
              {top_products.map((p, i) => (
                <li key={i}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-slate-700">
                      <span className="ml-1.5 text-xs font-bold text-gold-dark">{i + 1}.</span>
                      {p.name}
                    </span>
                    <span className="shrink-0 font-semibold text-navy-dark">{formatPrice(p.revenue)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gold-gradient"
                      style={{ width: `${(p.qty / maxQty) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Low stock */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-navy-dark">
              התראות מלאי
              {low_stock.length > 0 && (
                <span className="mr-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  {low_stock.length}
                </span>
              )}
            </h3>
            <Link href="/admin/inventory" className="text-sm text-brand hover:underline">
              למלאי
            </Link>
          </div>
          {low_stock.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">כל המוצרים מעל נקודת ההזמנה 👍</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {low_stock.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-sm text-slate-700">{p.name}</span>
                  <span className="shrink-0 text-sm font-bold text-rose-600">
                    {p.stock} / {p.reorder}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Recent orders ────────────────────────────────────────────── */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-navy-dark">הזמנות אחרונות</h3>
          <Link href="/admin/orders" className="text-sm text-brand hover:underline">
            לכל ההזמנות
          </Link>
        </div>
        {recent_orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">אין הזמנות עדיין.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent_orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/account/order?id=${o.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-dark">
                      {o.dealer ?? "—"}
                    </p>
                    <p className="font-mono text-xs text-slate-400">
                      {o.order_number} · {new Date(o.created_at).toLocaleDateString("he-IL")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${STATUS_BADGE[o.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {ORDER_STATUS_HE[o.status] ?? o.status}
                    </span>
                    <span className="font-bold text-brand-dark">{formatPrice(o.total, o.currency)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Quick actions ────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-500">פעולות מהירות</h3>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="card flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:shadow-md hover:text-navy"
            >
              <span aria-hidden>{a.icon}</span>
              {a.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Presentational pieces ─────────────────────────────────────────────────────

// Self-contained so its 1-second tick re-renders only itself, not the whole board.
function LiveClock() {
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-left">
      <p className="font-mono text-2xl font-bold tabular-nums text-white">
        {now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="text-xs text-white/45">
        {now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "gold" | "emerald" | "rose" | "plain";
  icon: string;
}) {
  const toneClass = {
    gold: "text-gold",
    emerald: "text-emerald-400",
    rose: "text-rose-400",
    plain: "text-white",
  }[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl bg-onyx-gradient p-4 shadow-onyx">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-gold-gradient opacity-70" />
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-white/55">{label}</p>
        <span className="text-base opacity-80" aria-hidden>
          {icon}
        </span>
      </div>
      <p className={`mt-2 text-2xl font-extrabold tracking-tight tabular-nums ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-white/40">{sub}</p>
    </div>
  );
}

function CounterTile({
  href,
  label,
  value,
  alert = false,
}: {
  href: string;
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-between rounded-2xl border p-3 transition-all ${
        alert
          ? "border-amber-300/50 bg-amber-50 hover:border-amber-400"
          : "border-navy/10 bg-white hover:border-gold/40 hover:shadow-gold"
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-extrabold tabular-nums ${
          alert ? "text-amber-600" : "text-navy-dark"
        }`}
      >
        {value}
      </p>
    </Link>
  );
}
