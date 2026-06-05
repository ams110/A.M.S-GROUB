/**
 * Margin engine — pure logic (no React, no Supabase).
 *
 * Every product carries a `cost`; this turns a selling price into profit and
 * margin %, and flags prices that are below cost (a loss) or dangerously thin.
 * Reused by the customer-prices editor, the quote builder and the admin product
 * list so the admin never sets a price that quietly loses money.
 *
 * Deterministic and side-effect free for unit testing.
 */

export type MarginInfo = {
  /** Absolute profit per unit (price − cost). */
  profit: number;
  /** Margin as a percentage of the selling price; 0 when price ≤ 0. */
  marginPct: number;
  /** Selling below cost — a guaranteed loss. */
  belowCost: boolean;
  /** Positive margin but under the "thin" threshold. */
  thin: boolean;
  /** True only when a cost is known (cost > 0); guards are meaningless otherwise. */
  known: boolean;
};

export type MarginOptions = {
  /** Margin % at or below which a price is flagged as "thin". Default 10%. */
  thinThresholdPct?: number;
};

export function computeMargin(
  price: number,
  cost: number,
  opts: MarginOptions = {}
): MarginInfo {
  const thinThreshold = opts.thinThresholdPct ?? 10;
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  const known = c > 0;
  const profit = p - c;
  const marginPct = p > 0 ? (profit / p) * 100 : 0;

  return {
    profit,
    marginPct,
    belowCost: known && p > 0 && p < c,
    thin: known && p >= c && marginPct < thinThreshold,
    known,
  };
}

/** Apply a percentage change to a price, rounded to 2 decimals (never below 0). */
export function applyPctChange(price: number, pct: number): number {
  const next = (Number(price) || 0) * (1 + (Number(pct) || 0) / 100);
  return Math.max(0, Math.round(next * 100) / 100);
}

/** A markup-from-cost price: cost × (1 + markup%), 2dp. */
export function priceFromMarkup(cost: number, markupPct: number): number {
  const next = (Number(cost) || 0) * (1 + (Number(markupPct) || 0) / 100);
  return Math.max(0, Math.round(next * 100) / 100);
}
