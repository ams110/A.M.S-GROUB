/**
 * Proactive reorder reminders — pure logic (no React, no Supabase).
 *
 * The dealer-facing /account/reorder screen lets a customer pull up the items
 * they buy on a cycle. This is the *outbound* half: scanning every customer's
 * history to find who is now **due** to reorder specific products — based on
 * each customer's own cadence — so the admin can nudge them (a ready WhatsApp
 * message with their usual items) before they drift away. Retention, automated.
 *
 * Built on the same `buildReorderSuggestions` engine, grouped per customer.
 * Deterministic and side-effect free for unit testing; `now` is injectable.
 */

import {
  buildReorderSuggestions,
  isDue,
  type ReorderItem,
  type ReorderOrder,
} from "./reorder";

export type ReminderOrder = ReorderOrder & {
  dealer_id: string;
  status?: string; // "cancelled" excluded
};

export type DueProduct = {
  product_id: string;
  name_he: string;
  /** Representative per-order quantity to suggest. */
  typicalQty: number;
  daysSinceLast: number;
  /** Mean days between this product's orders (their cadence). */
  avgIntervalDays: number | null;
  /** ≥1 means past due. */
  dueScore: number;
};

export type CustomerReorderReminder = {
  dealerId: string;
  /** Products this customer is due to reorder, most overdue first. */
  dueProducts: DueProduct[];
  /** The single most-overdue product's dueScore — drives ranking. */
  topDueScore: number;
};

export type ReorderRemindersOptions = {
  now?: Date;
  /**
   * How overdue a product must be before we flag it. 1 = exactly at the
   * customer's cadence; >1 = already late. Default 1 (don't nag early).
   */
  threshold?: number;
  /** Cap on due products listed per customer. Default 5. */
  maxPerCustomer?: number;
};

/**
 * Find customers who are due to reorder, with the specific products and the
 * quantity they typically buy. Most-overdue customers first.
 */
export function findReorderDueCustomers(
  orders: ReminderOrder[],
  items: ReorderItem[],
  opts: ReorderRemindersOptions = {}
): CustomerReorderReminder[] {
  const now = opts.now ?? new Date();
  const threshold = opts.threshold ?? 1;
  const maxPerCustomer = opts.maxPerCustomer ?? 5;

  // Which dealer each order belongs to (cancelled orders dropped entirely).
  const dealerOf = new Map<string, string>();
  const ordersByDealer = new Map<string, ReorderOrder[]>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    dealerOf.set(o.id, o.dealer_id);
    const arr = ordersByDealer.get(o.dealer_id) ?? [];
    arr.push({ id: o.id, created_at: o.created_at });
    ordersByDealer.set(o.dealer_id, arr);
  }

  // Bucket line items by dealer via their order.
  const itemsByDealer = new Map<string, ReorderItem[]>();
  for (const it of items) {
    const dealer = dealerOf.get(it.order_id);
    if (!dealer) continue;
    const arr = itemsByDealer.get(dealer) ?? [];
    arr.push(it);
    itemsByDealer.set(dealer, arr);
  }

  const out: CustomerReorderReminder[] = [];
  for (const [dealerId, dealerOrders] of ordersByDealer) {
    const suggestions = buildReorderSuggestions(
      dealerOrders,
      itemsByDealer.get(dealerId) ?? [],
      { now }
    );
    const due = suggestions
      .filter((s) => isDue(s, threshold))
      .sort((a, b) => b.dueScore - a.dueScore)
      .slice(0, maxPerCustomer)
      .map<DueProduct>((s) => ({
        product_id: s.product_id,
        name_he: s.name_he,
        typicalQty: s.typicalQty,
        daysSinceLast: s.daysSinceLast,
        avgIntervalDays: s.avgIntervalDays,
        dueScore: s.dueScore,
      }));

    if (due.length === 0) continue;
    out.push({ dealerId, dueProducts: due, topDueScore: due[0].dueScore });
  }

  return out.sort((a, b) => b.topDueScore - a.topDueScore);
}
