/**
 * Activity / recency engine — pure logic (no React, no Supabase).
 *
 * Two money problems share one primitive — "how long since the last activity?":
 *   • Dormant dealers — customers who used to order on a cadence and went quiet
 *     (lost revenue you can win back).
 *   • Dead stock — products sitting in the warehouse with no recent sales
 *     (capital frozen on the shelf).
 *
 * Both are derived here so the admin Operations Center can surface them as
 * concrete, actionable lists. Deterministic and side-effect free; `now` is
 * injectable for stable tests.
 */

const DAY = 24 * 60 * 60 * 1000;

// ── Dormant dealers ───────────────────────────────────────────────────────────

export type ActivityOrder = {
  dealer_id: string;
  created_at: string; // ISO timestamp
  status?: string; // "cancelled" excluded
  total?: number;
};

export type DormantDealer = {
  dealerId: string;
  lastOrderAt: string;
  daysSinceLast: number;
  ordersCount: number;
  lifetimeSpend: number;
  /** Mean days between this dealer's orders (their cadence). */
  avgIntervalDays: number;
  /** daysSinceLast / avgIntervalDays — higher means "more overdue to order". */
  overdueRatio: number;
};

export type DormantOptions = {
  now?: Date;
  /** Minimum orders before we can infer a cadence. Default 2. */
  minOrders?: number;
  /** Flag when idle longer than cadence × this factor. Default 1.5. */
  cadenceFactor?: number;
  /** Absolute floor (days) before a dealer can be "dormant". Default 21. */
  minIdleDays?: number;
};

/**
 * Dealers who have a clear ordering cadence but have gone quiet for noticeably
 * longer than usual. Most overdue first.
 */
export function findDormantDealers(
  orders: ActivityOrder[],
  opts: DormantOptions = {}
): DormantDealer[] {
  const now = (opts.now ?? new Date()).getTime();
  const minOrders = opts.minOrders ?? 2;
  const cadenceFactor = opts.cadenceFactor ?? 1.5;
  const minIdleDays = opts.minIdleDays ?? 21;

  const byDealer = new Map<string, { times: number[]; spend: number }>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const t = new Date(o.created_at).getTime();
    if (Number.isNaN(t)) continue;
    const e = byDealer.get(o.dealer_id) ?? { times: [], spend: 0 };
    e.times.push(t);
    e.spend += Number(o.total) || 0;
    byDealer.set(o.dealer_id, e);
  }

  const out: DormantDealer[] = [];
  for (const [dealerId, { times, spend }] of byDealer) {
    if (times.length < minOrders) continue;
    times.sort((a, b) => a - b);
    const last = times[times.length - 1];
    const daysSinceLast = Math.floor((now - last) / DAY);
    const span = last - times[0];
    const avgIntervalDays = span / (times.length - 1) / DAY;
    if (avgIntervalDays <= 0) continue;

    const isDormant =
      daysSinceLast >= minIdleDays && daysSinceLast > avgIntervalDays * cadenceFactor;
    if (!isDormant) continue;

    out.push({
      dealerId,
      lastOrderAt: new Date(last).toISOString(),
      daysSinceLast,
      ordersCount: times.length,
      lifetimeSpend: spend,
      avgIntervalDays: Math.round(avgIntervalDays),
      overdueRatio: daysSinceLast / avgIntervalDays,
    });
  }

  return out.sort((a, b) => b.overdueRatio - a.overdueRatio || b.lifetimeSpend - a.lifetimeSpend);
}

// ── Dead stock ────────────────────────────────────────────────────────────────

export type DeadStockProduct = {
  id: string;
  name_he: string;
  stock: number;
  cost: number;
};

export type DeadStockItem = {
  order_id: string;
  product_id: string | null;
  qty: number;
};

export type DeadStock = {
  productId: string;
  name_he: string;
  stock: number;
  /** Capital frozen on the shelf (stock × cost). */
  tiedCapital: number;
  lastSoldAt: string | null;
  /** Whole days since last sale; null when never sold. */
  daysSinceSold: number | null;
  /** Units sold inside the lookback window. */
  unitsSoldInWindow: number;
};

export type DeadStockOptions = {
  now?: Date;
  /** A product is "dead" when its last sale is older than this. Default 60d. */
  staleDays?: number;
};

/**
 * Products holding stock that haven't sold within the lookback window. Most
 * frozen capital first — that's the cash to free up.
 */
export function findDeadStock(
  products: DeadStockProduct[],
  orders: { id: string; created_at: string; status?: string }[],
  items: DeadStockItem[],
  opts: DeadStockOptions = {}
): DeadStock[] {
  const now = (opts.now ?? new Date()).getTime();
  const staleDays = opts.staleDays ?? 60;
  const cutoff = now - staleDays * DAY;

  const orderTime = new Map<string, number>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    orderTime.set(o.id, new Date(o.created_at).getTime());
  }

  // Per product: last sale time + units sold inside the window.
  const lastSold = new Map<string, number>();
  const unitsInWindow = new Map<string, number>();
  for (const it of items) {
    if (!it.product_id) continue;
    const t = orderTime.get(it.order_id);
    if (t == null) continue;
    if (t > (lastSold.get(it.product_id) ?? -Infinity)) lastSold.set(it.product_id, t);
    if (t >= cutoff) {
      unitsInWindow.set(it.product_id, (unitsInWindow.get(it.product_id) ?? 0) + it.qty);
    }
  }

  const out: DeadStock[] = [];
  for (const p of products) {
    if (!(p.stock > 0)) continue; // nothing on the shelf → nothing frozen
    const soldInWindow = unitsInWindow.get(p.id) ?? 0;
    if (soldInWindow > 0) continue; // it's still moving

    const last = lastSold.get(p.id) ?? null;
    out.push({
      productId: p.id,
      name_he: p.name_he,
      stock: p.stock,
      tiedCapital: p.stock * (Number(p.cost) || 0),
      lastSoldAt: last == null ? null : new Date(last).toISOString(),
      daysSinceSold: last == null ? null : Math.floor((now - last) / DAY),
      unitsSoldInWindow: 0,
    });
  }

  // Most frozen capital first; never-sold (null days) treated as oldest.
  return out.sort(
    (a, b) =>
      b.tiedCapital - a.tiedCapital ||
      (b.daysSinceSold ?? Infinity) - (a.daysSinceSold ?? Infinity)
  );
}
