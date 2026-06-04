/**
 * Smart Reorder — pure logic (no React, no Supabase).
 *
 * B2B dealers reorder the same items every cycle. Given a dealer's order
 * history, this ranks the products they buy by loyalty (how often) and
 * recency, infers a "typical" quantity, and flags items that are *due* for a
 * refill based on the dealer's own ordering cadence. The UI layer turns the
 * result into one-tap "add to cart" suggestions.
 *
 * Everything here is deterministic and side-effect free so it can be unit
 * tested without a database. `now` is injectable for stable tests.
 */

export type ReorderItem = {
  order_id: string;
  product_id: string | null;
  name_he: string;
  sku: string | null;
  qty: number;
  unit_price: number;
};

export type ReorderOrder = {
  id: string;
  created_at: string; // ISO timestamp
};

export type ReorderSuggestion = {
  product_id: string;
  name_he: string;
  sku: string | null;
  /** Distinct orders that contained this product. */
  timesOrdered: number;
  /** Sum of all quantities ever ordered. */
  totalQty: number;
  /** Representative per-order quantity (rounded median, min 1). */
  typicalQty: number;
  /** Unit price on the most recent order (a sensible default to show). */
  lastUnitPrice: number;
  /** ISO timestamp of the most recent order containing this product. */
  lastOrderedAt: string;
  /** Whole days since it was last ordered. */
  daysSinceLast: number;
  /** Mean gap (days) between orders of this product; null if ordered once. */
  avgIntervalDays: number | null;
  /** daysSinceLast / avgIntervalDays — ≥1 means "overdue". 0 when unknown. */
  dueScore: number;
  /** Combined ranking score (higher = surface first). */
  score: number;
};

const DAY = 24 * 60 * 60 * 1000;

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * An item is "due" when the dealer has a clear cadence (ordered ≥2 times) and
 * roughly that much time (or more) has passed since the last order.
 */
export function isDue(s: ReorderSuggestion, threshold = 0.8): boolean {
  return s.avgIntervalDays != null && s.dueScore >= threshold;
}

export function buildReorderSuggestions(
  orders: ReorderOrder[],
  items: ReorderItem[],
  opts: { now?: Date } = {}
): ReorderSuggestion[] {
  const now = opts.now ?? new Date();
  const orderDate = new Map(orders.map((o) => [o.id, new Date(o.created_at).getTime()]));

  // product_id → { per-order quantities, dates, running totals }
  type Agg = {
    name_he: string;
    sku: string | null;
    perOrderQty: Map<string, number>; // order_id → summed qty in that order
    orderTimes: Map<string, number>; // order_id → timestamp
    totalQty: number;
    lastTime: number;
    lastUnitPrice: number;
  };
  const byProduct = new Map<string, Agg>();

  for (const it of items) {
    if (!it.product_id) continue; // can't reliably re-add a deleted product
    const t = orderDate.get(it.order_id);
    if (t == null) continue; // item references an order we don't have
    let agg = byProduct.get(it.product_id);
    if (!agg) {
      agg = {
        name_he: it.name_he,
        sku: it.sku,
        perOrderQty: new Map(),
        orderTimes: new Map(),
        totalQty: 0,
        lastTime: -Infinity,
        lastUnitPrice: it.unit_price,
      };
      byProduct.set(it.product_id, agg);
    }
    agg.perOrderQty.set(it.order_id, (agg.perOrderQty.get(it.order_id) ?? 0) + it.qty);
    agg.orderTimes.set(it.order_id, t);
    agg.totalQty += it.qty;
    if (t >= agg.lastTime) {
      agg.lastTime = t;
      agg.lastUnitPrice = it.unit_price;
      agg.name_he = it.name_he; // keep the freshest label
    }
  }

  const suggestions: ReorderSuggestion[] = [];
  for (const [product_id, agg] of byProduct) {
    const timesOrdered = agg.perOrderQty.size;
    const typicalQty = Math.max(1, Math.round(median([...agg.perOrderQty.values()])));
    const daysSinceLast = Math.max(0, Math.floor((now.getTime() - agg.lastTime) / DAY));

    const times = [...agg.orderTimes.values()].sort((a, b) => a - b);
    let avgIntervalDays: number | null = null;
    if (times.length >= 2) {
      const span = times[times.length - 1] - times[0];
      avgIntervalDays = span / (times.length - 1) / DAY;
    }

    const dueScore = avgIntervalDays && avgIntervalDays > 0 ? daysSinceLast / avgIntervalDays : 0;
    const recencyFactor = 1 / (1 + daysSinceLast / 30); // decays over ~a month
    // Loyalty (frequency) leads, recency breaks ties, cadence gives a gentle
    // nudge — capped so a long-abandoned cyclic item can't outrank a fresh one.
    const score = timesOrdered + recencyFactor + Math.min(dueScore, 1.5) * 0.15;

    suggestions.push({
      product_id,
      name_he: agg.name_he,
      sku: agg.sku,
      timesOrdered,
      totalQty: agg.totalQty,
      typicalQty,
      lastUnitPrice: agg.lastUnitPrice,
      lastOrderedAt: new Date(agg.lastTime).toISOString(),
      daysSinceLast,
      avgIntervalDays: avgIntervalDays == null ? null : Math.round(avgIntervalDays),
      dueScore,
      score,
    });
  }

  return suggestions.sort((a, b) => b.score - a.score);
}
