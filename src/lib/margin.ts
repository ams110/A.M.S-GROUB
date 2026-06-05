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

export type PriceRecommendation = {
  /** The suggested unit price. */
  price: number;
  /** Why this price was chosen (Hebrew, for a tooltip/chip). */
  reason: string;
};

/**
 * Recommend a selling price for one product & customer. Order of preference:
 *   1. The price this customer paid most recently for this item (their anchor —
 *      stay consistent, never silently raise on them).
 *   2. The catalogue list price for their type.
 *   3. A cost-plus floor that guarantees a healthy target margin.
 * The result is never below the cost-plus floor when a cost is known, so a
 * remembered/list price that quietly loses money gets pulled up to break-even+.
 */
export function recommendPrice(opts: {
  cost: number;
  listPrice: number;
  /** The unit price on this customer's most recent order/quote of this item. */
  lastPaid?: number | null;
  /** Healthy margin to fall back to when nothing else is known. Default 25%. */
  targetMarginPct?: number;
}): PriceRecommendation {
  const target = opts.targetMarginPct ?? 25;
  const cost = Number(opts.cost) || 0;
  // cost-plus floor: price s.t. margin% == target  →  cost / (1 − target/100)
  const floor = cost > 0 && target < 100 ? Math.round((cost / (1 - target / 100)) * 100) / 100 : 0;

  if (opts.lastPaid && opts.lastPaid > 0) {
    const price = Math.max(opts.lastPaid, floor);
    return {
      price,
      reason:
        floor > opts.lastPaid
          ? "המחיר האחרון של הלקוח הועלה לרצפת רווחיות"
          : "המחיר האחרון ששילם הלקוח",
    };
  }
  if (opts.listPrice > 0) {
    const price = Math.max(opts.listPrice, floor);
    return {
      price,
      reason: floor > opts.listPrice ? "מחיר מחירון הועלה לרצפת רווחיות" : "מחיר מחירון",
    };
  }
  return { price: floor, reason: `מבוסס עלות + ${target}% רווח` };
}
