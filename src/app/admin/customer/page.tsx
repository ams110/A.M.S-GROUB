"use client";

/**
 * Customer file (360°) — one screen, the whole relationship.
 *
 * Reachable from the customers list (?id=<profile id>). It pulls the customer's
 * orders + line items and runs the pure `buildCustomer360` engine to show: a
 * risk read, receivables aging, spend pulse, the products they reorder, recent
 * orders, and the right WhatsApp action for the moment (payment reminder when
 * they owe, win-back when they've drifted). Static-export friendly: the id is
 * a query param, so no dynamic route / generateStaticParams needed.
 */

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import {
  buildCustomer360,
  daysSince,
  RISK_LEVEL_HE,
  type Customer360,
  type RiskLevel,
} from "@/lib/customer360";
import { termDays } from "@/lib/ar";
import { paymentReminderMessage, winBackMessage, waMessageLink } from "@/lib/messages";
import {
  CUSTOMER_TYPE_HE,
  PAYMENT_TERMS_HE,
  ORDER_STATUS_HE,
  formatPrice,
  compactPrice,
} from "@/lib/format";
import { BASE_PATH } from "@/lib/config";
import type { Order, OrderItem, Profile } from "@/lib/types";

const RISK_BADGE: Record<RiskLevel, string> = {
  high: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  medium: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};

function CustomerFile() {
  const id = useSearchParams().get("id") ?? "";
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dossier, setDossier] = useState<Customer360 | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", id).single();
      const { data: ords } = await supabase
        .from("orders")
        .select("*")
        .eq("dealer_id", id)
        .order("created_at", { ascending: false });
      const orderList = (ords as Order[]) ?? [];

      let itemList: OrderItem[] = [];
      if (orderList.length > 0) {
        const { data: its } = await supabase
          .from("order_items")
          .select("*")
          .in(
            "order_id",
            orderList.map((o) => o.id)
          );
        itemList = (its as OrderItem[]) ?? [];
      }

      const profile = (prof as Profile) ?? null;
      setCustomer(profile);
      setOrders(orderList);
      setDossier(
        buildCustomer360({
          termDays: termDays(profile?.payment_terms),
          orders: orderList.map((o) => ({
            id: o.id,
            total: o.total,
            payment_status: o.payment_status,
            status: o.status,
            created_at: o.created_at,
          })),
          items: itemList.map((it) => ({
            order_id: it.order_id,
            product_id: it.product_id,
            name_he: it.name_he,
            sku: it.sku,
            qty: it.qty,
            unit_price: it.unit_price,
          })),
        })
      );
      setLoading(false);
    })();
  }, [id]);

  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}${BASE_PATH}/` : "";

  if (loading) return <p className="text-slate-500">טוען…</p>;
  if (!customer || !dossier) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500">הלקוח לא נמצא.</p>
        <Link href="/admin/dealers" className="btn-outline inline-flex">← לרשימת הלקוחות</Link>
      </div>
    );
  }

  const { receivables: ar, pulse, topProducts, risk } = dossier;
  const name = customer.full_name || customer.company || "לקוח";

  const reminderLink =
    customer.phone && ar.outstanding > 0
      ? waMessageLink(
          customer.phone,
          paymentReminderMessage({
            name: customer.full_name || customer.company || undefined,
            amount: ar.outstanding,
            overdue: ar.overdue,
            oldestOverdueDays: ar.oldestOverdueDays,
            loginUrl,
          })
        )
      : null;

  const winBackLink =
    customer.phone && pulse.daysSinceLastOrder != null && pulse.daysSinceLastOrder > 30
      ? waMessageLink(
          customer.phone,
          winBackMessage({
            name: customer.full_name || customer.company || undefined,
            daysSinceLastOrder: pulse.daysSinceLastOrder,
            loginUrl,
          })
        )
      : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/dealers" className="text-sm text-brand hover:underline">
        ← לרשימת הלקוחות
      </Link>

      {/* Header */}
      <div className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-extrabold text-navy-dark">{name}</h2>
            <span className="badge bg-gold-50 text-navy">{CUSTOMER_TYPE_HE[customer.customer_type]}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${RISK_BADGE[risk.level]}`}>
              {RISK_LEVEL_HE[risk.level]} · {risk.score}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {customer.company && customer.company !== name ? `${customer.company} · ` : ""}
            {customer.phone || "ללא טלפון"} · תנאי תשלום: {PAYMENT_TERMS_HE[customer.payment_terms]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {reminderLink && (
            <a href={reminderLink} target="_blank" rel="noopener noreferrer" className="btn-primary gap-1.5">
              💬 תזכורת תשלום
            </a>
          )}
          {winBackLink && (
            <a href={winBackLink} target="_blank" rel="noopener noreferrer" className="btn-outline gap-1.5">
              🔄 החזרת לקוח
            </a>
          )}
          <Link href="/admin/quotes" className="btn-outline gap-1.5">📝 הצעת מחיר</Link>
          <Link href="/admin/customer-prices" className="btn-outline gap-1.5">🏷️ מחירים</Link>
        </div>
      </div>

      {/* Risk reasons */}
      {risk.level !== "low" && (
        <div className="card border-amber-500/20 p-4">
          <p className="mb-2 text-sm font-bold text-navy-dark">למה כדאי לשים לב</p>
          <ul className="space-y-1">
            {risk.reasons.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-amber-400">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="יתרה פתוחה"
          value={compactPrice(ar.outstanding)}
          title={formatPrice(ar.outstanding)}
          tone={ar.overdue > 0 ? "bad" : ar.outstanding > 0 ? "warn" : "good"}
          sub={ar.overdue > 0 ? `${formatPrice(ar.overdue)} באיחור` : "אין איחור"}
        />
        <Kpi
          label="הוצאה החודש"
          value={compactPrice(pulse.monthSpend)}
          title={formatPrice(pulse.monthSpend)}
          tone={pulse.spendDeltaPct != null && pulse.spendDeltaPct < 0 ? "warn" : "good"}
          sub={
            pulse.spendDeltaPct == null
              ? "—"
              : `${pulse.spendDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(pulse.spendDeltaPct))}% מהחודש שעבר`
          }
        />
        <Kpi
          label="סה״כ רכישות"
          value={compactPrice(pulse.lifetimeSpend)}
          title={formatPrice(pulse.lifetimeSpend)}
          sub={`${pulse.lifetimeOrders} הזמנות`}
        />
        <Kpi
          label="הזמנה אחרונה"
          value={pulse.daysSinceLastOrder == null ? "—" : `לפני ${pulse.daysSinceLastOrder}י׳`}
          tone={pulse.daysSinceLastOrder != null && pulse.daysSinceLastOrder > 45 ? "warn" : "good"}
          sub={`ממוצע הזמנה ${compactPrice(pulse.avgOrderValue)}`}
        />
      </div>

      {/* Aging */}
      {ar.outstanding > 0 && (
        <section className="card p-5">
          <h3 className="mb-3 font-bold text-navy-dark">גיול חוב</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Aging label="שוטף" value={ar.buckets.current} />
            <Aging label="1–30 ימים" value={ar.buckets.d1_30} warn />
            <Aging label="31–60 ימים" value={ar.buckets.d31_60} warn />
            <Aging label="60+ ימים" value={ar.buckets.d60_plus} bad />
          </div>
        </section>
      )}

      {/* Top products */}
      <section className="card p-5">
        <h3 className="mb-3 font-bold text-navy-dark">המוצרים שהלקוח מזמין</h3>
        {topProducts.length === 0 ? (
          <p className="text-sm text-slate-400">אין עדיין היסטוריית הזמנות.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-white/10 text-slate-400">
                <tr>
                  <th className="py-2">מוצר</th>
                  <th className="py-2">פעמים</th>
                  <th className="py-2">כמות אופיינית</th>
                  <th className="py-2">הוזמן לאחרונה</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.product_id} className="border-b border-white/5">
                    <td className="py-2 font-medium text-slate-200">{p.name_he}</td>
                    <td className="py-2">{p.timesOrdered}</td>
                    <td className="py-2">{p.typicalQty}</td>
                    <td className="py-2 text-slate-400">לפני {p.daysSinceLast} ימים</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent orders */}
      <section className="card p-5">
        <h3 className="mb-3 font-bold text-navy-dark">הזמנות אחרונות</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400">אין הזמנות.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {orders.slice(0, 6).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium text-slate-200">#{o.order_number}</span>
                <span className="text-slate-400">{daysSince(o.created_at)}י׳</span>
                <span className="badge bg-white/5 text-slate-300">{ORDER_STATUS_HE[o.status] ?? o.status}</span>
                <span className="font-bold text-navy-dark">{formatPrice(o.total, o.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  title,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  title?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "bad" ? "text-rose-400" : tone === "warn" ? "text-amber-400" : "text-navy-dark";
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${toneClass}`} title={title}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Aging({ label, value, warn, bad }: { label: string; value: number; warn?: boolean; bad?: boolean }) {
  const tone = bad ? "text-rose-400" : warn ? "text-amber-400" : "text-slate-200";
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center ring-1 ring-white/10">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 font-extrabold ${tone}`}>{formatPrice(value)}</p>
    </div>
  );
}

export default function CustomerFilePage() {
  const { ready, profile } = useProfile();
  if (ready && !profile) return null;
  return (
    <Suspense fallback={<p className="text-slate-500">טוען…</p>}>
      <CustomerFile />
    </Suspense>
  );
}
