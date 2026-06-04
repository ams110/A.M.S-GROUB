"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { formatPrice, ORDER_STATUS_HE } from "@/lib/format";
import { loadDashboard, type DashboardData, type RangeDays } from "@/lib/dashboard";
import { CountUp, TrendBadge, Sparkline, BarChart, Skeleton, useNow } from "@/components/dash";

const RANGES: { v: RangeDays; label: string }[] = [
  { v: 7, label: "7 ימים" },
  { v: 14, label: "14 יום" },
  { v: 30, label: "30 יום" },
];

const QUICK_ACTIONS = [
  { href: "/admin/products/edit", label: "מוצר חדש", icon: "➕" },
  { href: "/admin/orders", label: "הזמנות", icon: "📦" },
  { href: "/admin/quotes", label: "הצעות מחיר", icon: "📝" },
  { href: "/admin/dealers", label: "לקוחות", icon: "👥" },
  { href: "/admin/inventory", label: "מלאי", icon: "🏷️" },
  { href: "/admin/purchase-orders", label: "רכש", icon: "🚚" },
  { href: "/admin/settings", label: "הגדרות", icon: "⚙️" },
];

function greeting(h: number) {
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

export default function AdminDashboard() {
  const { isSuperAdmin, profile } = useProfile();
  const now = useNow();
  const [range, setRange] = useState<RangeDays>(14);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (r: RangeDays) => {
    const supabase = createClient();
    try {
      setData(await loadDashboard(supabase, r));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial + range change
  useEffect(() => {
    setLoading(true);
    reload(range);
  }, [range, reload]);

  // Live: realtime on new orders + 60s polling fallback
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-orders-live")
      .on("postgres_changes", { event: "*", schema: "store", table: "orders" }, () => reload(range))
      .subscribe();
    const poll = setInterval(() => reload(range), 60000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [range, reload]);

  const name = profile?.company || profile?.full_name || "";
  const dateStr = now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  const timeStr = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const fmt = (n: number) => formatPrice(n, data?.currency ?? "ILS");

  const summary = (() => {
    if (!data) return "טוען נתונים…";
    const tasks: string[] = [];
    if (data.pendingOrders) tasks.push(`${data.pendingOrders} הזמנות לאישור`);
    if (data.pendingDealers) tasks.push(`${data.pendingDealers} סוחרים לאישור`);
    if (data.lowStock.length) tasks.push(`${data.lowStock.length} מוצרים במלאי נמוך`);
    return tasks.length ? `דרושה תשומת לב: ${tasks.join(" · ")}` : "הכל מטופל — אין משימות פתוחות 👌";
  })();

  return (
    <div className="space-y-6">
      {/* ── Hero / live activity ───────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-onyx-gradient p-6 shadow-onyx sm:p-8">
        <div className="pointer-events-none absolute -top-20 -left-20 h-60 w-60 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow flex items-center gap-2 text-gold/80">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              סקירת פעילות חיה
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {greeting(now.getHours())}
              {name ? <>, <span className="text-gradient-gold">{name}</span></> : null}
            </h1>
            <p className="mt-1 text-sm text-white/55">{dateStr}</p>
            <p className="mt-3 text-sm text-white/75">{summary}</p>
          </div>
          <div className="text-left">
            <div className="font-mono text-3xl font-bold tabular-nums text-white sm:text-4xl">{timeStr}</div>
            <div className="mt-3 inline-flex rounded-full bg-white/8 p-1 ring-1 ring-white/10">
              {RANGES.map((r) => (
                <button
                  key={r.v}
                  onClick={() => setRange(r.v)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    range === r.v ? "bg-gold-gradient text-navy-dark shadow-gold" : "text-white/60 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Financial KPIs (super-admin only) ──────────────────── */}
      {isSuperAdmin && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiDark
            label="הכנסות ששולמו"
            loading={loading}
            value={data?.revenuePaid ?? 0}
            fmt={fmt}
            accent="gold"
            trend={data && { current: data.revenuePaid, previous: data.revenuePrev }}
            spark={data?.dailyRevenue}
          />
          <KpiDark
            label="רווח גולמי (אומדן)"
            loading={loading}
            value={data?.grossProfit ?? 0}
            fmt={fmt}
            accent="emerald"
            hint={data ? `מרווח ${data.marginPct.toFixed(1)}%` : undefined}
          />
          <KpiDark
            label="הכנסות החודש"
            loading={loading}
            value={data?.monthlyRevenue ?? 0}
            fmt={fmt}
            accent="white"
          />
        </section>
      )}

      {/* ── Operational KPIs ───────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiLight label={`הזמנות (${range} ימים)`} loading={loading} value={data?.ordersInRange ?? 0}
          href="/admin/orders" accent="text-navy-dark"
          trend={data && { current: data.ordersInRange, previous: data.ordersPrev }} />
        <KpiLight label="הזמנות ממתינות" loading={loading} value={data?.pendingOrders ?? 0}
          href="/admin/orders" accent={data?.pendingOrders ? "text-amber-600" : "text-navy-dark"}
          hint={data?.pendingOrders ? "ממתינות לאישור" : "הכל מטופל"} />
        <KpiLight label="סוחרים לאישור" loading={loading} value={data?.pendingDealers ?? 0}
          href="/admin/dealers" accent={data?.pendingDealers ? "text-amber-600" : "text-navy-dark"} />
        <KpiLight label="מלאי נמוך" loading={loading} value={data?.lowStock.length ?? 0}
          href="/admin/inventory" accent={data?.lowStock.length ? "text-rose-600" : "text-navy-dark"} />
      </section>

      {/* ── Quick actions ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.href} href={a.href}
            className="card flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-gold/40 hover:text-navy hover:shadow-gold">
            <span aria-hidden>{a.icon}</span>{a.label}
          </Link>
        ))}
      </div>

      {/* ── Revenue chart (super-admin) ────────────────────────── */}
      {isSuperAdmin && (
        <section className="rounded-3xl bg-onyx-gradient p-6 shadow-onyx">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-white">מגמת הכנסות · {range} ימים</h2>
            <span className="text-sm font-bold text-gradient-gold">{data ? fmt(data.revenuePaid) : ""}</span>
          </div>
          {loading || !data ? (
            <Skeleton className="h-40 bg-white/5" />
          ) : (
            <BarChart data={data.dailyRevenue} labels={data.dailyLabels} format={fmt} />
          )}
        </section>
      )}

      {/* ── Funnel ─────────────────────────────────────────────── */}
      <section className="card p-5">
        <h2 className="mb-4 font-bold text-navy-dark">משפך הזמנות · {range} ימים</h2>
        {loading || !data ? (
          <Skeleton className="h-16" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.funnel.map((f) => (
              <div key={f.status} className="flex-1 min-w-[90px] rounded-xl border border-navy/10 bg-navy-50 p-3 text-center">
                <div className="text-2xl font-extrabold text-navy-dark">{f.count}</div>
                <div className="mt-0.5 text-xs text-slate-500">{ORDER_STATUS_HE[f.status] ?? f.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Leaderboards ───────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-navy-dark">המוצרים הנמכרים ביותר</h2>
          {loading || !data ? (
            <SkeletonRows />
          ) : data.topProducts.length === 0 ? (
            <Empty>אין מכירות בתקופה.</Empty>
          ) : (
            <ol className="space-y-2">
              {data.topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <Rank i={i} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{p.name}</span>
                  <span className="shrink-0 text-sm font-bold text-navy-dark">{p.qty} יח׳</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold text-navy-dark">הלקוחות המובילים</h2>
          {loading || !data ? (
            <SkeletonRows />
          ) : data.topCustomers.length === 0 ? (
            <Empty>אין הזמנות בתקופה.</Empty>
          ) : (
            <ol className="space-y-2">
              {data.topCustomers.map((c, i) => (
                <li key={c.name + i} className="flex items-center gap-3">
                  <Rank i={i} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{c.name}</span>
                  <span className="shrink-0 text-sm font-bold text-brand-dark">{fmt(c.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* ── Recent orders + low stock ──────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-navy-dark">הזמנות אחרונות</h2>
            <Link href="/admin/orders" className="text-sm text-brand hover:underline">לכל ההזמנות</Link>
          </div>
          {loading || !data ? (
            <SkeletonRows />
          ) : data.recentOrders.length === 0 ? (
            <Empty>אין הזמנות עדיין.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/account/order?id=${o.id}`} className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-70">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-slate-500">{o.order_number}</p>
                      <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString("he-IL")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{ORDER_STATUS_HE[o.status] ?? o.status}</span>
                      <span className="font-bold text-brand-dark">{formatPrice(o.total, o.currency)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-navy-dark">
              מלאי נמוך
              {data && data.lowStock.length > 0 && (
                <span className="mr-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{data.lowStock.length}</span>
              )}
            </h2>
            <Link href="/admin/purchase-orders" className="text-sm text-brand hover:underline">הזמנת רכש</Link>
          </div>
          {loading || !data ? (
            <SkeletonRows />
          ) : data.lowStock.length === 0 ? (
            <Empty>כל המוצרים מעל נקודת ההזמנה. 👍</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.lowStock.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <p className="min-w-0 truncate text-sm text-slate-700">{p.name_he}</p>
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-sm font-semibold text-rose-600">{p.stock} / {p.reorder_point}</span>
                    <Link href="/admin/purchase-orders" className="rounded-lg bg-gold-gradient px-2.5 py-1 text-xs font-bold text-navy-dark shadow-gold">הזמן</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiDark({
  label, value, fmt, accent, loading, trend, spark, hint,
}: {
  label: string; value: number; fmt: (n: number) => string;
  accent: "gold" | "emerald" | "white"; loading: boolean;
  trend?: { current: number; previous: number } | null | false;
  spark?: number[]; hint?: string;
}) {
  const color = accent === "gold" ? "text-gradient-gold" : accent === "emerald" ? "text-emerald-400" : "text-white";
  return (
    <div className="relative overflow-hidden rounded-2xl bg-onyx-gradient p-5 shadow-onyx ring-1 ring-white/5">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-gold-gradient opacity-70" />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/55">{label}</p>
        {trend && <TrendBadge current={trend.current} previous={trend.previous} />}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-32 bg-white/5" />
      ) : (
        <p className={`mt-2 text-3xl font-extrabold tracking-tight ${color}`}>
          <CountUp value={value} format={fmt} />
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-white/45">{hint}</p>}
      {spark && spark.length > 1 && (
        <div className="mt-3"><Sparkline data={spark} width={220} height={34} /></div>
      )}
    </div>
  );
}

function KpiLight({
  label, value, href, accent, loading, trend, hint,
}: {
  label: string; value: number; href: string; accent: string; loading: boolean;
  trend?: { current: number; previous: number } | null | false; hint?: string;
}) {
  return (
    <Link href={href} className="card card-hover group relative overflow-hidden p-5">
      <span className="absolute inset-x-0 top-0 h-1 bg-gold-gradient opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {trend && (
          <span className="opacity-90">
            {/* light-bg trend */}
            <TrendBadgeLight current={trend.current} previous={trend.previous} />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className={`mt-2 text-3xl font-extrabold tracking-tight ${accent}`}>
          <CountUp value={value} />
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Link>
  );
}

function TrendBadgeLight({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0 && current <= 0) return null;
  const pct = previous <= 0 ? 100 : ((current - previous) / previous) * 100;
  const up = pct >= 0;
  const flat = Math.abs(pct) < 0.05;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
      flat ? "bg-slate-100 text-slate-500" : up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
    }`}>
      {flat ? "—" : up ? "▲" : "▼"} {Math.abs(pct).toFixed(flat ? 0 : 1)}%
    </span>
  );
}

function Rank({ i }: { i: number }) {
  const styles = ["bg-gold-gradient text-navy-dark", "bg-slate-200 text-slate-700", "bg-amber-200 text-amber-800"];
  return (
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${styles[i] ?? "bg-slate-100 text-slate-500"}`}>
      {i + 1}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

function SkeletonRows() {
  return (
    <div className="space-y-2.5 py-1">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}
    </div>
  );
}
