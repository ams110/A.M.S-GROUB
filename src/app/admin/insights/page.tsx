"use client";

/**
 * מסע התובנות — Insights Journey.
 *
 * A cinematic, multi-step admin co-pilot. Each step is a question the business
 * asks *itself* ("how much did I make?", "who's slipping away?", "who owes me?")
 * and answers from real data, with a one-tap action (WhatsApp / deep link).
 *
 * All numbers come from the existing operations RPC `admin_ops_dashboard` plus
 * the pure intelligence engines (ar.ts, activity.ts) run client-side — no new
 * DB objects, static-export friendly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BASE_PATH } from "@/lib/config";
import { formatPrice, compactPrice } from "@/lib/format";
import { greeting } from "@/lib/briefing";
import { termDays, computeReceivablesByDealer, type DealerReceivables } from "@/lib/ar";
import { findDormantDealers, type DormantDealer } from "@/lib/activity";
import { paymentReminderMessage, winBackMessage } from "@/lib/messages";
import { waLink, waPhone } from "@/lib/onboarding";

// ── Shape of the operations dashboard RPC ──────────────────────────────────────
type Dash = {
  kpi: { revenue: number; profit: number; cogs: number; orders: number; units: number };
  prev: { revenue: number; profit: number };
  counts: {
    orders_pending: number;
    dealers_pending: number;
    quotes_pending: number;
    products_low: number;
    dealers_total: number;
    products_total: number;
    inventory_value: number;
  };
  series: { day: string; revenue: number; profit: number; orders: number }[];
  top_products: { name: string; qty: number; revenue: number; profit: number; margin: number }[];
  categories: { name: string; revenue: number; profit: number; margin: number }[];
  low_stock: { name: string; stock: number; reorder: number; per_day: number; days_left: number | null }[];
  goal: { target: number; actual: number };
};

type DealerInfo = { name: string; phone: string | null };

type Loaded = {
  dash: Dash;
  dealers: Map<string, DealerInfo>;
  receivables: (DealerReceivables & DealerInfo)[];
  dormant: (DormantDealer & DealerInfo)[];
  ordersTotal: number;
};

const WINDOW_DAYS = 30;

// A fixed scatter of stars — constant so SSR and client render identically.
const STARS = [
  [6, 18], [14, 62], [22, 30], [31, 80], [38, 12], [46, 48], [53, 88],
  [61, 22], [68, 66], [74, 38], [82, 16], [88, 72], [93, 44], [12, 90],
  [27, 54], [42, 70], [57, 34], [71, 90], [85, 56], [96, 24],
];

export default function InsightsJourney() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const loginUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://ams-groub.linko.services/";
    return `${window.location.origin}${BASE_PATH}/`;
  }, []);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const now = new Date();
      const from = new Date(now.getTime() - WINDOW_DAYS * 86400_000);
      const iso = (d: Date) => d.toISOString().slice(0, 10);

      const [dashRes, ordersRes, dealersRes] = await Promise.all([
        supabase.rpc("admin_ops_dashboard", { p_from: iso(from), p_to: iso(now) }),
        supabase.from("orders").select("id,dealer_id,total,payment_status,status,created_at"),
        supabase.from("profiles").select("id,full_name,company,phone,payment_terms").eq("role", "dealer"),
      ]);

      if (dashRes.error) {
        setError(dashRes.error.message);
        return;
      }

      const dash = dashRes.data as Dash;
      const orders = (ordersRes.data ?? []) as {
        id: string; dealer_id: string; total: number; payment_status: string; status: string; created_at: string;
      }[];
      const dealerRows = (dealersRes.data ?? []) as {
        id: string; full_name: string | null; company: string | null; phone: string | null; payment_terms: string | null;
      }[];

      const dealers = new Map<string, DealerInfo>();
      const termsByDealer: Record<string, number> = {};
      for (const d of dealerRows) {
        dealers.set(d.id, { name: d.company || d.full_name || "לקוח", phone: d.phone });
        termsByDealer[d.id] = termDays(d.payment_terms);
      }

      const info = (id: string): DealerInfo => dealers.get(id) ?? { name: "לקוח", phone: null };

      const receivables = computeReceivablesByDealer(orders, termsByDealer)
        .filter((r) => r.overdue > 0)
        .slice(0, 5)
        .map((r) => ({ ...r, ...info(r.dealerId) }));

      const dormant = findDormantDealers(orders)
        .slice(0, 5)
        .map((d) => ({ ...d, ...info(d.dealerId) }));

      setData({ dash, dealers, receivables, dormant, ordersTotal: orders.length });
    })().catch((e) => setError(String(e?.message ?? e)));
  }, []);

  // ── Build the journey steps from the loaded data ─────────────────────────────
  const slides = useMemo<Slide[]>(() => {
    if (!data) return [];
    return buildSlides(data, loginUrl);
  }, [data, loginUrl]);

  const total = slides.length;
  const go = useCallback(
    (dir: 1 | -1) => setStep((s) => Math.min(total - 1, Math.max(0, s + dir))),
    [total]
  );

  // Arrow-key navigation (RTL: ← advances, → goes back).
  useEffect(() => {
    if (!total) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(1);
      else if (e.key === "ArrowRight") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total]);

  // ── States ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-rose-500">לא הצלחנו לטעון את הנתונים.</p>
        <p className="mt-1 text-xs text-slate-500">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center">
        <div className="mx-auto h-14 w-14 animate-orb rounded-full bg-gold-gradient" />
        <p className="mt-5 text-sm text-slate-500">מנתחים את הנתונים…</p>
      </div>
    );
  }

  const current = slides[step];

  return (
    <div className="mx-auto max-w-2xl pb-10">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <p className="eyebrow">מסע התובנות</p>
        <Link href="/admin" className="text-sm text-brand hover:underline">
          ← לדף הניהול
        </Link>
      </div>

      {/* Progress dots */}
      <div className="mb-5 flex items-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.key}
            aria-label={s.label}
            onClick={() => setStep(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-7 bg-gold-gradient" : i < step ? "w-3 bg-gold/50" : "w-3 bg-white/15"
            }`}
          />
        ))}
      </div>

      {/* The stage */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-[rgba(20,18,15,0.55)] p-7 shadow-gold-lg backdrop-blur-md sm:p-9">
        {/* Constellation backdrop */}
        <Stars />

        <div key={current.key} className="relative animate-fade-up">
          {current.node}
        </div>
      </div>

      {/* Footer nav */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          onClick={() => go(-1)}
          disabled={step === 0}
          className="btn-outline disabled:opacity-30"
        >
          → הקודם
        </button>
        <span className="text-xs text-slate-400">
          {step + 1} / {total}
        </span>
        {step < total - 1 ? (
          <button onClick={() => go(1)} className="btn-gold">
            הבא ←
          </button>
        ) : (
          <Link href="/admin" className="btn-gold">
            סיום ✓
          </Link>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════ Slide builder ════════════════════════════════════

type Slide = { key: string; label: string; node: React.ReactNode };

function buildSlides(data: Loaded, loginUrl: string): Slide[] {
  const { dash, receivables, dormant } = data;
  const slides: Slide[] = [];

  // 0 · Intro
  slides.push({
    key: "intro",
    label: "פתיחה",
    node: (
      <div className="py-6 text-center">
        <Orb emoji="✨" />
        <p className="mt-5 text-sm text-gold-dark">{greeting()}</p>
        <h2 className="mt-1 text-3xl font-extrabold leading-tight">
          בוא נגלה מה <span className="text-gradient-gold-shimmer">קורה בעסק</span> שלך
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-slate-400">
          ניתחתי את הפעילות מ־{WINDOW_DAYS} הימים האחרונים — {dash.kpi.orders} הזמנות,
          {" "}{dash.counts.dealers_total} לקוחות. הנה מה שחשוב שתדע, צעד אחר צעד.
        </p>
        <div className="mt-6 flex justify-center gap-2 text-xs text-slate-400">
          <Chip>💰 רווחיות</Chip>
          <Chip>👥 לקוחות</Chip>
          <Chip>📦 מלאי</Chip>
        </div>
      </div>
    ),
  });

  // 1 · Profit pulse
  const revDelta = pctChange(dash.kpi.revenue, dash.prev.revenue);
  const profitUp = dash.kpi.profit >= dash.prev.profit;
  const marginPct = dash.kpi.revenue > 0 ? (dash.kpi.profit / dash.kpi.revenue) * 100 : 0;
  slides.push({
    key: "profit",
    label: "רווחיות",
    node: (
      <Insight emoji="💰" question="כמה הרווחתי החודש?">
        <div className="flex items-end justify-center gap-2">
          <CountMoney value={dash.kpi.profit} className="text-4xl font-extrabold text-gradient-gold" />
        </div>
        <p className="mt-1 text-center text-xs text-slate-400">
          רווח נקי מתוך {formatPrice(dash.kpi.revenue)} מכירות · מרווח {marginPct.toFixed(0)}%
        </p>

        <div className="mt-5">
          <Sparkline data={dash.series.map((d) => d.revenue)} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="מחזור" value={compactPrice(dash.kpi.revenue)} delta={revDelta} />
          <Stat
            label="לעומת התקופה הקודמת"
            value={profitUp ? "במגמת עלייה" : "בירידה"}
            tone={profitUp ? "good" : "bad"}
          />
        </div>

        {dash.goal.target > 0 && (
          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-white/[0.04] p-4">
            <Ring pct={dash.goal.target ? dash.goal.actual / dash.goal.target : 0} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">יעד החודש</p>
              <p className="text-xs text-slate-400">
                {formatPrice(dash.goal.actual)} מתוך {formatPrice(dash.goal.target)}
              </p>
            </div>
          </div>
        )}
      </Insight>
    ),
  });

  // 2 · Who owes me
  slides.push({
    key: "receivables",
    label: "גבייה",
    node: (
      <Insight emoji="🧾" question="מי חייב לי כסף — ובאיחור?">
        {receivables.length === 0 ? (
          <Empty emoji="🎉" text="אין חובות באיחור. הגבייה שלך נקייה!" />
        ) : (
          <>
            <p className="text-center text-sm text-slate-400">
              {receivables.length} לקוחות עם יתרה באיחור. שלח תזכורת עדינה בלחיצה:
            </p>
            <div className="mt-4 space-y-2">
              {receivables.map((r) => {
                const msg = paymentReminderMessage({
                  name: r.name,
                  amount: r.outstanding,
                  overdue: r.overdue,
                  oldestOverdueDays: r.oldestOverdueDays,
                  loginUrl,
                });
                return (
                  <Row
                    key={r.dealerId}
                    title={r.name}
                    sub={`באיחור ${formatPrice(r.overdue)}${
                      r.oldestOverdueDays ? ` · ${r.oldestOverdueDays} ימים` : ""
                    }`}
                    accent={formatPrice(r.overdue)}
                    phone={r.phone}
                    message={msg}
                    cta="תזכורת"
                  />
                );
              })}
            </div>
          </>
        )}
        <DeepLink href="/admin/dealers" label="לכל הלקוחות והחובות ←" />
      </Insight>
    ),
  });

  // 3 · Who's slipping away
  slides.push({
    key: "dormant",
    label: "לקוחות נרדמים",
    node: (
      <Insight emoji="🌙" question="מי מהלקוחות מתחיל להיעלם?">
        {dormant.length === 0 ? (
          <Empty emoji="💪" text="כל הלקוחות הפעילים מזמינים בקצב. אין נשירה." />
        ) : (
          <>
            <p className="text-center text-sm text-slate-400">
              לקוחות שהזמינו בקביעות ופתאום שתקו — הזדמנות להחזיר אותם:
            </p>
            <div className="mt-4 space-y-2">
              {dormant.map((d) => {
                const msg = winBackMessage({
                  name: d.name,
                  daysSinceLastOrder: d.daysSinceLast,
                  loginUrl,
                });
                return (
                  <Row
                    key={d.dealerId}
                    title={d.name}
                    sub={`לא הזמין ${d.daysSinceLast} ימים · רגיל כל ~${d.avgIntervalDays} ימים`}
                    accent={formatPrice(d.lifetimeSpend)}
                    phone={d.phone}
                    message={msg}
                    cta="התגעגענו"
                  />
                );
              })}
            </div>
          </>
        )}
        <DeepLink href="/admin/dealers" label="לניהול הלקוחות ←" />
      </Insight>
    ),
  });

  // 4 · What's running out
  const lows = dash.low_stock.slice(0, 6);
  slides.push({
    key: "stock",
    label: "מלאי",
    node: (
      <Insight emoji="📦" question="מה עומד להיגמר מהמלאי?">
        {lows.length === 0 ? (
          <Empty emoji="✅" text="המלאי במצב טוב. שום פריט לא מתקרב לסף." />
        ) : (
          <div className="space-y-2">
            {lows.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    נותרו {p.stock} יח׳ · סף {p.reorder}
                  </p>
                </div>
                <DaysLeft days={p.days_left} />
              </div>
            ))}
          </div>
        )}
        <DeepLink href="/admin/purchase-orders" label="ליצירת הזמנת רכש ←" />
      </Insight>
    ),
  });

  // 5 · Best performers
  const tops = dash.top_products.slice(0, 5);
  const bestCat = dash.categories[0];
  slides.push({
    key: "winners",
    label: "מובילים",
    node: (
      <Insight emoji="🏆" question="מה הכי רווחי אצלי?">
        {tops.length === 0 ? (
          <Empty emoji="📈" text="עדיין אין מספיק מכירות בתקופה הזו." />
        ) : (
          <div className="space-y-2">
            {tops.map((p, i) => (
              <div
                key={p.name}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-bold text-gold">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {p.qty} יח׳ · מרווח {p.margin.toFixed(0)}%
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-gradient-gold">
                  {compactPrice(p.profit)}
                </span>
              </div>
            ))}
            {bestCat && (
              <p className="pt-1 text-center text-xs text-slate-400">
                הקטגוריה המובילה: <span className="text-gold-dark">{bestCat.name}</span> · רווח{" "}
                {compactPrice(bestCat.profit)}
              </p>
            )}
          </div>
        )}
        <DeepLink href="/home" label="לסקירה החיה המלאה ←" />
      </Insight>
    ),
  });

  // 6 · Summary / action plan
  const actions = summaryActions(data);
  slides.push({
    key: "summary",
    label: "סיכום",
    node: (
      <div className="py-2 text-center">
        <Orb emoji="🧭" />
        <h2 className="mt-5 text-2xl font-extrabold">תוכנית הפעולה שלך להיום</h2>
        <p className="mt-1 text-sm text-slate-400">{actions.length} צעדים שיזיזו את המחט.</p>
        <div className="mt-5 space-y-2 text-right">
          {actions.length === 0 ? (
            <Empty emoji="🌟" text="הכול תחת שליטה. יום מצוין להגדיל מכירות!" />
          ) : (
            actions.map((a) => (
              <Link
                key={a.href + a.title}
                href={a.href}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.08]"
              >
                <span className="text-xl">{a.icon}</span>
                <span className="flex-1 text-sm">{a.title}</span>
                <span className="text-gold/70">←</span>
              </Link>
            ))
          )}
        </div>
      </div>
    ),
  });

  return slides;
}

type Action = { icon: string; title: string; href: string };

function summaryActions(data: Loaded): Action[] {
  const { dash, receivables, dormant } = data;
  const out: Action[] = [];
  if (dash.counts.orders_pending > 0)
    out.push({ icon: "📦", title: `${dash.counts.orders_pending} הזמנות ממתינות לאישור`, href: "/admin/orders" });
  if (dash.counts.dealers_pending > 0)
    out.push({ icon: "👤", title: `${dash.counts.dealers_pending} לקוחות ממתינים לאישור`, href: "/admin/dealers" });
  if (receivables.length > 0)
    out.push({ icon: "🧾", title: `${receivables.length} לקוחות עם חוב באיחור — לגבות`, href: "/admin/dealers" });
  if (dormant.length > 0)
    out.push({ icon: "🌙", title: `${dormant.length} לקוחות נרדמים — להחזיר`, href: "/admin/dealers" });
  if (dash.low_stock.length > 0)
    out.push({ icon: "📦", title: `${dash.low_stock.length} פריטים מתקרבים לסף מלאי`, href: "/admin/purchase-orders" });
  if (dash.counts.quotes_pending > 0)
    out.push({ icon: "📝", title: `${dash.counts.quotes_pending} הצעות מחיר פתוחות`, href: "/admin/quotes" });
  return out;
}

// ════════════════════════════ Presentational bits ══════════════════════════════

function Insight({ emoji, question, children }: { emoji: string; question: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-center">
        <Orb emoji={emoji} small />
        <h2 className="mx-auto mt-4 max-w-md text-xl font-extrabold leading-snug">{question}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Orb({ emoji, small }: { emoji: string; small?: boolean }) {
  return (
    <div
      className={`animate-float mx-auto grid place-items-center rounded-full bg-gradient-to-b from-gold/25 to-transparent ring-1 ring-gold/30 ${
        small ? "h-14 w-14 text-2xl" : "h-20 w-20 text-4xl"
      }`}
    >
      <span className="animate-orb grid h-[78%] w-[78%] place-items-center rounded-full bg-[rgba(20,18,15,0.7)]">
        {emoji}
      </span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-gold/20 bg-white/[0.04] px-3 py-1 font-medium">{children}</span>
  );
}

function Stat({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta?: number;
  tone?: "good" | "bad";
}) {
  const deltaTone = delta == null ? "" : delta >= 0 ? "text-emerald-400" : "text-rose-400";
  const valTone = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-white";
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3 text-center">
      <p className={`text-base font-bold ${valTone}`}>{value}</p>
      {delta != null && (
        <p className={`text-xs font-semibold ${deltaTone}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
        </p>
      )}
      <p className="mt-0.5 text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

function Row({
  title,
  sub,
  accent,
  phone,
  message,
  cta,
}: {
  title: string;
  sub: string;
  accent: string;
  phone: string | null;
  message: string;
  cta: string;
}) {
  const hasPhone = !!phone && waPhone(phone).length >= 11;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-slate-400">{sub}</p>
      </div>
      {hasPhone ? (
        <a
          href={waLink(phone as string, message)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-95"
        >
          <WhatsAppIcon />
          {cta}
        </a>
      ) : (
        <span className="shrink-0 text-sm font-bold text-gradient-gold">{accent}</span>
      )}
    </div>
  );
}

function Empty({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-4 py-8 text-center">
      <div className="text-4xl">{emoji}</div>
      <p className="mt-2 text-sm text-slate-300">{text}</p>
    </div>
  );
}

function DeepLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mt-4 block text-center text-sm font-semibold text-gold hover:underline">
      {label}
    </Link>
  );
}

function DaysLeft({ days }: { days: number | null }) {
  if (days == null)
    return <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">—</span>;
  const tone =
    days <= 3 ? "bg-rose-500/20 text-rose-300" : days <= 10 ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/15 text-emerald-300";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>
      {days} ימים
    </span>
  );
}

function Stars() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map(([x, y], i) => (
        <span
          key={i}
          className="animate-twinkle absolute rounded-full bg-gold"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: i % 4 === 0 ? 3 : 2,
            height: i % 4 === 0 ? 3 : 2,
            animationDelay: `${(i % 7) * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Count-up money (re-runs on each slide mount) ───────────────────────────────
function CountMoney({ value, className }: { value: number; className?: string }) {
  const [v, setV] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    const start = performance.now();
    const dur = 850;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(value * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value]);
  return <span className={className}>{formatPrice(Math.round(v))}</span>;
}

// ── Sparkline of daily revenue ─────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2)
    return <p className="text-center text-xs text-slate-500">אין מספיק נתונים לגרף</p>;
  const w = 280;
  const h = 60;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => [
    (i / (data.length - 1)) * w,
    h - ((d - min) / range) * (h - 8) - 4,
  ]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mx-auto block w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0BE45" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#E0BE45" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={line} fill="none" stroke="#E0BE45" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="#FBF1CF" />
    </svg>
  );
}

// ── Goal progress ring ─────────────────────────────────────────────────────────
function Ring({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="#E0BE45"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
        style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)" }}
      />
      <text x="32" y="34" textAnchor="middle" className="rotate-90" transform="rotate(90 32 32)" fontSize="14" fontWeight="700" fill="#E8E2D6">
        {Math.round(clamped * 100)}%
      </text>
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.523 5.26l-.999 3.648 3.965-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
    </svg>
  );
}

function pctChange(now: number, prev: number): number {
  if (!prev) return now > 0 ? 100 : 0;
  return ((now - prev) / prev) * 100;
}
