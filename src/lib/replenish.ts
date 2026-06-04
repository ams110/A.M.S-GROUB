/**
 * Smart Replenishment — pure logic (no React, no Supabase).
 *
 * The admin Operations Center already forecasts which products are about to
 * run out (stock vs reorder point, plus a velocity-based "days left"). This
 * module turns that forecast into a concrete purchase-order draft: for every
 * low-stock product it computes how many units to buy to cover a target
 * horizon (sales velocity × coverage + lead-time buffer), never below the
 * minimum order quantity. The UI prefills the existing "new PO" form with the
 * result, so the forecast becomes a ready action.
 *
 * Deterministic and side-effect free for unit testing.
 */

export type ReplenishProduct = {
  id: string;
  name_he: string;
  stock: number;
  reorder_point: number;
  min_order_qty: number;
  cost: number;
};

export type ReplenishSuggestion = {
  product_id: string;
  name_he: string;
  stock: number;
  reorder_point: number;
  /** Units sold per day over the sampled window (0 when unknown). */
  perDay: number;
  /** Whole days of stock left at current velocity; null when velocity unknown. */
  daysLeft: number | null;
  /** Units to order. */
  suggestedQty: number;
  unitCost: number;
  lineCost: number;
};

export type ReplenishOptions = {
  /** Days of stock we want to hold after restocking. */
  coverageDays?: number;
  /** Supplier lead-time buffer added on top of coverage. */
  leadDays?: number;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Per-product sales velocity (units/day) from recent order history.
 * Only items belonging to orders inside the window are counted.
 */
export function computeSalesVelocity(
  orders: { id: string; created_at: string }[],
  items: { order_id: string; product_id: string | null; qty: number }[],
  opts: { windowDays?: number; now?: Date } = {}
): Record<string, number> {
  const windowDays = opts.windowDays ?? 30;
  const now = opts.now ?? new Date();
  const cutoff = now.getTime() - windowDays * DAY;

  const inWindow = new Set(
    orders.filter((o) => new Date(o.created_at).getTime() >= cutoff).map((o) => o.id)
  );

  const totals: Record<string, number> = {};
  for (const it of items) {
    if (!it.product_id || !inWindow.has(it.order_id)) continue;
    totals[it.product_id] = (totals[it.product_id] ?? 0) + it.qty;
  }

  const velocity: Record<string, number> = {};
  for (const pid in totals) velocity[pid] = totals[pid] / windowDays;
  return velocity;
}

export function suggestReplenishment(
  products: ReplenishProduct[],
  velocity: Record<string, number> = {},
  opts: ReplenishOptions = {}
): ReplenishSuggestion[] {
  const coverageDays = opts.coverageDays ?? 30;
  const leadDays = opts.leadDays ?? 7;

  const out: ReplenishSuggestion[] = [];
  for (const p of products) {
    // Only products that opted into reorder tracking and are at/below the point.
    if (!(p.reorder_point > 0) || p.stock > p.reorder_point) continue;

    const perDay = velocity[p.id] ?? 0;
    // Velocity-driven target when we have data, else twice the reorder point.
    const velocityTarget = perDay > 0 ? perDay * (coverageDays + leadDays) : p.reorder_point * 2;
    const target = Math.max(p.reorder_point, velocityTarget);

    const minQty = p.min_order_qty > 0 ? p.min_order_qty : 1;
    const suggestedQty = Math.max(minQty, Math.ceil(target - p.stock));
    const daysLeft = perDay > 0 ? Math.floor(p.stock / perDay) : null;
    const unitCost = p.cost > 0 ? p.cost : 0;

    out.push({
      product_id: p.id,
      name_he: p.name_he,
      stock: p.stock,
      reorder_point: p.reorder_point,
      perDay,
      daysLeft,
      suggestedQty,
      unitCost,
      lineCost: suggestedQty * unitCost,
    });
  }

  // Most urgent first: soonest to run out, then deepest below reorder point.
  return out.sort((a, b) => {
    const da = a.daysLeft ?? Infinity;
    const db = b.daysLeft ?? Infinity;
    if (da !== db) return da - db;
    return b.reorder_point - b.stock - (a.reorder_point - a.stock);
  });
}
