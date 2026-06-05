/**
 * Daily Briefing — pure logic (no React, no Supabase).
 *
 * The Operations Center answers "how is the business doing?". This answers a
 * sharper, daily question: "what do I need to *do* today?". It scans the same
 * raw data (orders, customers, products, quotes) and emits a short, ranked list
 * of concrete action items — orders to approve, money overdue, stock running
 * out, quotes going stale, customers drifting away — each with a count, a
 * one-line Hebrew summary, a severity and a deep link. The admin home renders
 * it as a morning checklist.
 *
 * Deterministic and side-effect free for unit testing; `now` is injectable.
 */

import { computeReceivablesByDealer, termDays, type AROrder } from "./ar";
import { findDormantDealers, type ActivityOrder } from "./activity";

export type Severity = "urgent" | "attention" | "info";

export type BriefingItem = {
  key: string;
  icon: string;
  /** Short Hebrew title. */
  title: string;
  /** One-line Hebrew detail. */
  detail: string;
  /** Headline number shown as a badge. */
  count: number;
  severity: Severity;
  href: string;
};

export type BriefingInput = {
  orders: (AROrder & ActivityOrder & { id: string; status?: string })[];
  dealers: { id: string; payment_terms?: string | null; status?: string }[];
  products: { reorder_point: number; stock: number }[];
  quotes: { status: string; valid_until: string | null }[];
  now?: Date;
};

const DAY = 24 * 60 * 60 * 1000;
const SEVERITY_RANK: Record<Severity, number> = { urgent: 0, attention: 1, info: 2 };

export function buildBriefing(input: BriefingInput): BriefingItem[] {
  const now = input.now ?? new Date();
  const items: BriefingItem[] = [];

  // ── Orders waiting for approval ──────────────────────────────────────────
  const pendingOrders = input.orders.filter((o) => o.status === "pending").length;
  if (pendingOrders > 0) {
    items.push({
      key: "pending-orders",
      icon: "📦",
      title: "הזמנות לאישור",
      detail: `${pendingOrders} הזמנות ממתינות לאישורך`,
      count: pendingOrders,
      severity: "urgent",
      href: "/admin/orders",
    });
  }

  // ── Pending dealer signups ───────────────────────────────────────────────
  const pendingDealers = input.dealers.filter((d) => d.status === "pending").length;
  if (pendingDealers > 0) {
    items.push({
      key: "pending-dealers",
      icon: "👤",
      title: "לקוחות לאישור",
      detail: `${pendingDealers} בקשות הצטרפות ממתינות`,
      count: pendingDealers,
      severity: "attention",
      href: "/admin/dealers",
    });
  }

  // ── Overdue receivables ──────────────────────────────────────────────────
  const termsByDealer: Record<string, number> = {};
  for (const d of input.dealers) termsByDealer[d.id] = termDays(d.payment_terms);
  const ar = computeReceivablesByDealer(input.orders, termsByDealer, { now });
  const overdueDealers = ar.filter((r) => r.overdue > 0);
  const overdueTotal = overdueDealers.reduce((s, r) => s + r.overdue, 0);
  if (overdueDealers.length > 0) {
    items.push({
      key: "overdue",
      icon: "💰",
      title: "תשלומים באיחור",
      detail: `${overdueDealers.length} לקוחות · ₪${Math.round(overdueTotal).toLocaleString("he-IL")} באיחור`,
      count: overdueDealers.length,
      severity: "urgent",
      href: "/admin/dealers",
    });
  }

  // ── Low stock ────────────────────────────────────────────────────────────
  const lowStock = input.products.filter(
    (p) => p.reorder_point > 0 && p.stock <= p.reorder_point
  ).length;
  if (lowStock > 0) {
    items.push({
      key: "low-stock",
      icon: "📉",
      title: "מלאי נמוך",
      detail: `${lowStock} מוצרים מתחת לנקודת ההזמנה`,
      count: lowStock,
      severity: lowStock >= 5 ? "urgent" : "attention",
      href: "/admin/purchase-orders",
    });
  }

  // ── Quotes awaiting a reply / expiring soon ──────────────────────────────
  const openQuotes = input.quotes.filter((q) => q.status === "sent");
  const expiringSoon = openQuotes.filter((q) => {
    if (!q.valid_until) return false;
    const left = (new Date(q.valid_until).getTime() - now.getTime()) / DAY;
    return left >= 0 && left <= 3;
  }).length;
  if (openQuotes.length > 0) {
    items.push({
      key: "open-quotes",
      icon: "📝",
      title: "הצעות מחיר פתוחות",
      detail:
        expiringSoon > 0
          ? `${openQuotes.length} ממתינות לתשובה · ${expiringSoon} פגות תוך 3 ימים`
          : `${openQuotes.length} ממתינות לתשובת הלקוח`,
      count: openQuotes.length,
      severity: expiringSoon > 0 ? "attention" : "info",
      href: "/admin/quotes",
    });
  }

  // ── Customers drifting away ──────────────────────────────────────────────
  const dormant = findDormantDealers(input.orders, { now });
  if (dormant.length > 0) {
    items.push({
      key: "dormant",
      icon: "🔄",
      title: "לקוחות שנרדמו",
      detail: `${dormant.length} לקוחות קבועים הפסיקו להזמין`,
      count: dormant.length,
      severity: "info",
      href: "/admin",
    });
  }

  return items.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count
  );
}

/** A short Hebrew greeting for the time of day. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}
