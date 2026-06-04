/**
 * Dealer Pulse — pure logic (no React, no Supabase).
 *
 * A compact "where do I stand?" snapshot for the dealer's personal area:
 * spend this calendar month vs last month, lifetime activity, average order
 * value, and how long since the last order. The UI renders it as a card that
 * also nudges toward Smart Reorder, so status turns into action.
 *
 * Cancelled orders are excluded (they aren't committed spend). Deterministic
 * and side-effect free for unit testing; `now` is injectable.
 */

export type PulseOrder = {
  total: number;
  status: string;
  created_at: string; // ISO timestamp
};

export type DealerPulse = {
  monthSpend: number;
  prevMonthSpend: number;
  /** Percent change vs previous month; null when prev month had no spend. */
  spendDeltaPct: number | null;
  monthOrders: number;
  lifetimeOrders: number;
  lifetimeSpend: number;
  avgOrderValue: number;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
};

const DAY = 24 * 60 * 60 * 1000;

function pctDelta(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

export function computeDealerPulse(
  orders: PulseOrder[],
  opts: { now?: Date } = {}
): DealerPulse {
  const now = opts.now ?? new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  const committed = orders.filter((o) => o.status !== "cancelled");

  let monthSpend = 0;
  let prevMonthSpend = 0;
  let monthOrders = 0;
  let lifetimeSpend = 0;
  let lastTime: number | null = null;

  for (const o of committed) {
    const t = new Date(o.created_at).getTime();
    const total = Number(o.total) || 0;
    lifetimeSpend += total;
    if (lastTime == null || t > lastTime) lastTime = t;

    if (t >= monthStart) {
      monthSpend += total;
      monthOrders += 1;
    } else if (t >= prevMonthStart && t < monthStart) {
      prevMonthSpend += total;
    }
  }

  const lifetimeOrders = committed.length;

  return {
    monthSpend,
    prevMonthSpend,
    spendDeltaPct: pctDelta(monthSpend, prevMonthSpend),
    monthOrders,
    lifetimeOrders,
    lifetimeSpend,
    avgOrderValue: lifetimeOrders > 0 ? lifetimeSpend / lifetimeOrders : 0,
    lastOrderAt: lastTime == null ? null : new Date(lastTime).toISOString(),
    daysSinceLastOrder: lastTime == null ? null : Math.floor((now.getTime() - lastTime) / DAY),
  };
}
