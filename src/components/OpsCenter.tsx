"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, compactPrice, ORDER_STATUS_HE } from "@/lib/format";
import Aurora from "@/components/Aurora";
import ReceivablesPanel from "@/components/ReceivablesPanel";
import OpportunitiesPanel from "@/components/OpportunitiesPanel";
import ReorderRemindersPanel from "@/components/ReorderRemindersPanel";

// ── Shape of store.admin_ops_dashboard() ─────────────────────────────────────

type Dash = {
  generated_at: string;
  range: { from: string; to: string; days: number; prev_from: string; prev_to: string };
  kpi: { revenue: number; profit: number; cogs: number; orders: number; units: number };
  prev: { revenue: number; profit: number };
  counts: {
    orders_pending: number;
    dealers_pending: number;
    quotes_pending: number;
    products_low: number;
    orders_today: number;
    dealers_total: number;
    products_total: number;
    inventory_value: number;
    inventory_retail: number;
  };
  orders_by_status: Record<string, number>;
  series: { day: string; revenue: number; profit: number; orders: number }[];
  top_products: { name: string; qty: number; revenue: number; profit: number; margin: number }[];
  categories: { name: string; revenue: number; profit: number; margin: number }[];
  low_stock: { name: string; stock: number; reorder: number; per_day: number; days_left: number | null }[];
  activity: {
    type: "order" | "dealer";
    at: string;
    title: string;
    detail: string;
    amount: number | null;
    status: string;
  }[];
  goal: { target: number; actual: number };
};

// ── Date helpers ─────────────────────────────────────────────────────────────

const iso = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};
const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

function presetRange(key: string): { from: string; to: string } {
  const today = new Date();
  switch (key) {
    case "7d":
      return { from: iso(addDays(today, -6)), to: iso(today) };
    case "30d":
      return { from: iso(addDays(today, -29)), to: iso(today) };
    case "90d":
      return { from: iso(addDays(today, -89)), to: iso(today) };
    case "month":
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
    case "prev_month": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: iso(first), to: iso(last) };
    }
    default:
      return { from: iso(addDays(today, -13)), to: iso(today) };
  }
}

const PRESETS = [
  { key: "7d", label: "7 ימים" },
  { key: "14d", label: "14 יום" },
  { key: "30d", label: "30 יום" },
  { key: "90d", label: "90 יום" },
  { key: "month", label: "החודש" },
  { key: "prev_month", label: "חודש שעבר" },
];

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

type Metric = "revenue" | "profit" | "orders";
const METRIC_LABEL: Record<Metric, string> = { revenue: "הכנסות", profit: "רווח", orders: "הזמנות" };
const METRIC_COLOR: Record<Metric, string> = { revenue: "#E0BE45", profit: "#4ADE80", orders: "#60A5FA" };

export default function OpsCenter() {
  const initial = useMemo(() => presetRange("14d"), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [activePreset, setActivePreset] = useState("14d");

  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("revenue");
  const firstLoad = useRef(true);

  const load = useCallback(async (f: string, t: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_ops_dashboard", { p_from: f, p_to: t });
    if (error) setError(error.message);
    else {
      setData(data as Dash);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (firstLoad.current) firstLoad.current = false;
    else setLoading(true);
    load(from, to);
  }, [from, to, load]);

  // silent auto-refresh every 60s — fallback when realtime is unavailable
  useEffect(() => {
    const poll = setInterval(() => load(from, to), 60_000);
    return () => clearInterval(poll);
  }, [from, to, load]);

  // Live updates: refresh the dashboard the moment an order changes instead of
  // waiting for the 60s poll. Requires store.orders in the supabase_realtime
  // publication (see 20260608_realtime_orders.sql). The poll above stays as a
  // safety net if realtime isn't enabled on the project.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("ops-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "store", table: "orders" },
        () => load(from, to),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [from, to, load]);

  const applyPreset = (key: string) => {
    setActivePreset(key);
    const r = presetRange(key);
    setFrom(r.from);
    setTo(r.to);
  };

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["יום", "הכנסות", "רווח", "הזמנות"],
      ...data.series.map((d) => [d.day, d.revenue, d.profit, d.orders]),
      [],
      ["מוצר", "כמות", "הכנסות", "רווח", "מרווח %"],
      ...data.top_products.map((p) => [p.name, p.qty, p.revenue, p.profit, p.margin]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ams-report_${data.range.from}_${data.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          טוען נתוני מערכת…
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-rose-600">לא ניתן לטעון את נתוני המערכת.</p>
        {error && <p className="mt-2 text-xs text-slate-400">{error}</p>}
        <button onClick={() => load(from, to)} className="btn-primary mt-4">
          נסה שוב
        </button>
      </div>
    );
  }

  const { kpi, prev, counts, orders_by_status, series, top_products, categories, low_stock, activity, goal } = data;
  const margin = kpi.revenue > 0 ? (kpi.profit / kpi.revenue) * 100 : 0;
  const revDelta = pctDelta(kpi.revenue, prev.revenue);
  const profitDelta = pctDelta(kpi.profit, prev.profit);
  const statusEntries = Object.entries(orders_by_status).sort((a, b) => b[1] - a[1]);
  const statusTotal = statusEntries.reduce((s, [, c]) => s + c, 0);
  const maxQty = Math.max(1, ...top_products.map((p) => p.qty));
  const goalPct = goal.target > 0 ? Math.min(100, (goal.actual / goal.target) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* ── Command bar ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-onyx-gradient p-5 shadow-onyx sm:p-6">
        <Aurora />
        <span className="absolute inset-x-0 top-0 h-px hairline-gold" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow text-gold/80">מרכז שליטה</p>
            <h2 className="mt-1 flex items-center gap-2.5 text-2xl font-extrabold text-white">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              סקירת פעילות <span className="text-gradient-gold-shimmer">חיה</span>
            </h2>
          </div>
          <LiveClock />
        </div>

        {/* presets */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                activePreset === p.key
                  ? "bg-gold-gradient text-navy-dark shadow-gold"
                  : "bg-white/8 text-white/55 hover:bg-white/14 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
          {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />}
        </div>

        {/* custom range + export */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-white/40">טווח מותאם:</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setActivePreset("");
              setFrom(e.target.value);
            }}
            className="rounded-lg border border-white/15 bg-white/8 px-2 py-1 text-white [color-scheme:dark]"
          />
          <span className="text-white/40">→</span>
          <input
            type="date"
            value={to}
            min={from}
            max={iso(new Date())}
            onChange={(e) => {
              setActivePreset("");
              setTo(e.target.value);
            }}
            className="rounded-lg border border-white/15 bg-white/8 px-2 py-1 text-white [color-scheme:dark]"
          />
          <button
            onClick={exportCsv}
            className="mr-auto rounded-lg border border-gold/30 bg-gold/10 px-3 py-1 font-semibold text-gold transition hover:bg-gold/20"
          >
            ⤓ ייצוא CSV
          </button>
        </div>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="הכנסות בתקופה" value={compactPrice(kpi.revenue)} delta={revDelta} tone="gold" icon="💰" />
        <KpiCard
          label="רווח גולמי (אומדן)"
          value={compactPrice(kpi.profit)}
          sub={`מרווח ${margin.toFixed(1)}%`}
          delta={profitDelta}
          tone="emerald"
          icon="📈"
        />
        <KpiCard label="הזמנות בתקופה" value={String(kpi.orders)} sub={`${kpi.units} יחידות`} tone="plain" icon="🧾" />
        <KpiCard
          label="שווי מלאי (מחירון)"
          value={compactPrice(counts.inventory_retail)}
          sub={`עלות: ${compactPrice(counts.inventory_value)}`}
          tone="plain"
          icon="📦"
        />
      </div>

      {/* ── Chart + counters ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl bg-onyx-gradient p-5 shadow-onyx lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white">מגמת פעילות</h3>
              <p className="text-xs text-white/40">
                {data.range.from} → {data.range.to} · {data.range.days} ימים
              </p>
            </div>
            <div className="flex gap-1.5">
              {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    metric === m ? "bg-white/15 text-white" : "bg-white/5 text-white/45 hover:text-white"
                  }`}
                >
                  {METRIC_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <TrendChart series={series} metric={metric} />
        </div>

        {/* counters */}
        <div className="grid grid-cols-2 gap-3">
          <CounterTile href="/admin/dealers" label="סוחרים לאישור" value={counts.dealers_pending} alert={counts.dealers_pending > 0} />
          <CounterTile href="/admin/orders" label="הזמנות ממתינות" value={counts.orders_pending} alert={counts.orders_pending > 0} />
          <CounterTile href="/admin/quotes" label="הצעות פתוחות" value={counts.quotes_pending} alert={counts.quotes_pending > 0} />
          <CounterTile href="/admin/inventory" label="מלאי נמוך" value={counts.products_low} alert={counts.products_low > 0} />
          <CounterTile href="/admin/orders" label="הזמנות היום" value={counts.orders_today} />
          <CounterTile href="/admin/dealers" label="סוחרים פעילים" value={counts.dealers_total} />
        </div>
      </div>

      {/* ── Goal ─────────────────────────────────────────────────────── */}
      <GoalCard goal={goal} pct={goalPct} onSaved={() => load(from, to)} />

      {/* ── Breakdown row ────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Order status */}
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
                    <div className={`h-full rounded-full ${STATUS_DOT[status] ?? "bg-slate-300"}`} style={{ width: `${(c / statusTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Categories */}
        <section className="card p-5">
          <h3 className="mb-3 font-bold text-navy-dark">רווחיות לפי קטגוריה</h3>
          {categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">אין מכירות בתקופה.</p>
          ) : (
            <ul className="space-y-3">
              {categories.slice(0, 6).map((c, i) => (
                <li key={i}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-slate-700">{c.name}</span>
                    <span className="shrink-0 font-semibold text-navy-dark">{formatPrice(c.revenue)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-xs text-slate-400">
                    <span>רווח {formatPrice(c.profit)}</span>
                    <span className={c.margin >= 0 ? "text-emerald-600" : "text-rose-600"}>מרווח {c.margin}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Low stock + forecast */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-navy-dark">
              התראות מלאי
              {low_stock.length > 0 && (
                <span className="mr-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{low_stock.length}</span>
              )}
            </h3>
            <Link href="/admin/inventory" className="text-sm text-brand hover:underline">למלאי</Link>
          </div>
          {low_stock.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">כל המוצרים מעל נקודת ההזמנה 👍</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {low_stock.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-sm text-slate-700">{p.name}</span>
                  <span className="shrink-0 text-left">
                    <span className="block text-sm font-bold text-rose-600">{p.stock} / {p.reorder}</span>
                    {p.days_left != null && (
                      <span className="block text-[11px] text-amber-600">אוזל בעוד ~{p.days_left} ימים</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Receivables / debt collection ────────────────────────────── */}
      <ReceivablesPanel />

      {/* ── Growth opportunities: win-back + dead stock ──────────────── */}
      <OpportunitiesPanel />

      {/* ── Proactive reorder reminders ──────────────────────────────── */}
      <ReorderRemindersPanel />

      {/* ── Top products + Activity ──────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-navy-dark">מוצרים מובילים</h3>
            <Link href="/admin/products" className="text-sm text-brand hover:underline">למוצרים</Link>
          </div>
          {top_products.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">אין מכירות בתקופה.</p>
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
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${(p.qty / maxQty) * 100}%` }} />
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-emerald-600">{p.margin}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Activity feed */}
        <section className="card p-5">
          <h3 className="mb-3 font-bold text-navy-dark">פעילות אחרונה</h3>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">אין פעילות עדיין.</p>
          ) : (
            <ul className="space-y-1">
              {activity.slice(0, 10).map((a, i) => (
                <li key={i} className="flex items-center gap-3 py-1.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm ${a.type === "order" ? "bg-gold/10" : "bg-sky-100"}`}>
                    {a.type === "order" ? "🧾" : "👤"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy-dark">{a.title}</p>
                    <p className="truncate text-xs text-slate-400">
                      {a.type === "order" ? a.detail : "סוחר חדש"} · {timeAgo(a.at)}
                    </p>
                  </div>
                  {a.amount != null ? (
                    <span className="shrink-0 text-sm font-bold text-brand-dark">{formatPrice(a.amount)}</span>
                  ) : (
                    <span className={`badge ${STATUS_BADGE[a.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {ORDER_STATUS_HE[a.status] ?? a.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-500">פעולות מהירות</h3>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="card flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:shadow-md hover:text-navy">
              <span aria-hidden>{a.icon}</span>
              {a.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pctDelta(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

function timeAgo(at: string): string {
  const diff = Date.now() - new Date(at).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} ד׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} ש׳`;
  const d = Math.floor(h / 24);
  return `לפני ${d} ימים`;
}

// ── Interactive trend chart ──────────────────────────────────────────────────

function TrendChart({ series, metric }: { series: Dash["series"]; metric: Metric }) {
  const [hover, setHover] = useState<number | null>(null);
  if (series.length === 0) return <div className="grid h-48 place-items-center text-sm text-white/40">אין נתונים</div>;

  const W = 720;
  const H = 220;
  const pad = { t: 16, r: 12, b: 28, l: 12 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const vals = series.map((d) => d[metric]);
  const max = Math.max(1, ...vals);
  const n = series.length;
  const x = (i: number) => pad.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const color = METRIC_COLOR[metric];
  const empty = vals.every((v) => v === 0);

  const line = series.map((d, i) => `${x(i)},${y(d[metric])}`).join(" ");
  const areaPath =
    n > 1
      ? `M ${x(0)},${y(series[0][metric])} ${series.map((d, i) => `L ${x(i)},${y(d[metric])}`).join(" ")} L ${x(n - 1)},${pad.t + innerH} L ${x(0)},${pad.t + innerH} Z`
      : "";

  const fmt = (v: number) => (metric === "orders" ? String(v) : compactPrice(v));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - pad.l) / innerW) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
      >
        <defs>
          <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={pad.l} x2={W - pad.r} y1={pad.t + innerH * (1 - g)} y2={pad.t + innerH * (1 - g)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        ))}
        {!empty && (
          <>
            {areaPath && <path d={areaPath} fill="url(#metricFill)" />}
            <polyline points={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {hover != null && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                <circle cx={x(hover)} cy={y(series[hover][metric])} r={4} fill={color} stroke="#0C0B0A" strokeWidth={2} />
              </>
            )}
          </>
        )}
      </svg>

      {empty && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-white/40">אין נתוני {METRIC_LABEL[metric]} לתקופה זו</div>}

      {hover != null && !empty && (
        <div
          className="pointer-events-none absolute top-1 rounded-lg bg-black/80 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <p className="font-semibold text-gold">{fmt(series[hover][metric])}</p>
          <p className="text-white/50">{new Date(series[hover].day).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}</p>
        </div>
      )}
    </div>
  );
}

// ── Goal card with inline editor ─────────────────────────────────────────────

function GoalCard({ goal, pct, onSaved }: { goal: Dash["goal"]; pct: number; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(goal.target || ""));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const month = iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const { error } = await supabase.from("sales_targets").upsert({ month, target: Number(val) || 0 }, { onConflict: "month" });
    setSaving(false);
    if (!error) {
      setEditing(false);
      onSaved();
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-onyx-gradient p-5 shadow-onyx">
      <span className="absolute inset-x-0 top-0 h-px hairline-gold" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-gold/80">יעד החודש</p>
          <p className="mt-1 text-2xl font-extrabold text-white">
            {formatPrice(goal.actual)}
            {goal.target > 0 && <span className="text-base font-medium text-white/45"> / {formatPrice(goal.target)}</span>}
          </p>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="יעד בש״ח"
              className="w-32 rounded-lg border border-white/15 bg-white/8 px-2 py-1 text-sm text-white [color-scheme:dark]"
            />
            <button onClick={save} disabled={saving} className="rounded-lg bg-gold-gradient px-3 py-1 text-sm font-bold text-navy-dark">
              {saving ? "…" : "שמור"}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-white/50">ביטול</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="rounded-lg border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold text-white/70 hover:bg-white/14">
            {goal.target > 0 ? "ערוך יעד" : "הגדר יעד"}
          </button>
        )}
      </div>
      {goal.target > 0 && (
        <div className="mt-3">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gold-gradient transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-white/45">{pct.toFixed(0)}% מהיעד הושג</p>
        </div>
      )}
    </section>
  );
}

// ── Small presentational pieces ──────────────────────────────────────────────

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
      <p className="text-xs text-white/45">{now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  delta,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  tone: "gold" | "emerald" | "rose" | "plain";
  icon: string;
}) {
  const toneClass = { gold: "text-gold", emerald: "text-emerald-400", rose: "text-rose-400", plain: "text-white" }[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl bg-onyx-gradient p-4 shadow-onyx">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-gold-gradient opacity-70" />
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-white/55">{label}</p>
        <span className="text-base opacity-80" aria-hidden>{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-extrabold tracking-tight tabular-nums ${toneClass}`}>{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta != null && (
          <span className={`font-semibold ${delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {sub && <span className="text-white/40">{sub}</span>}
        {delta != null && !sub && <span className="text-white/40">מול התקופה הקודמת</span>}
      </div>
    </div>
  );
}

function CounterTile({ href, label, value, alert = false }: { href: string; label: string; value: number; alert?: boolean }) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-between rounded-2xl border p-3 transition-all ${
        alert ? "border-amber-300/50 bg-amber-50 hover:border-amber-400" : "border-navy/10 bg-white hover:border-gold/40 hover:shadow-gold"
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${alert ? "text-amber-600" : "text-navy-dark"}`}>{value}</p>
    </Link>
  );
}
