/**
 * Accounts-Receivable (AR) engine — pure logic (no React, no Supabase).
 *
 * The store already tracks unpaid orders and each dealer's `payment_terms`
 * (immediate / net30 / net60), but nothing turned that into "who owes us, and
 * who is *late*". This module does exactly that: given a dealer's orders and
 * their payment terms it computes outstanding balance, what is overdue, an
 * aging breakdown (current / 1-30 / 31-60 / 60+), and how old the oldest
 * overdue invoice is. The same primitive powers the checkout credit warning,
 * the dealers list, the admin AR panel and WhatsApp payment reminders — one
 * engine, many screens.
 *
 * Deterministic and side-effect free for unit testing; `now` is injectable.
 */

export type PaymentTermsKey = "immediate" | "net30" | "net60";

/** Net days each payment term grants before an order is considered due. */
export const TERMS_DAYS: Record<PaymentTermsKey, number> = {
  immediate: 0,
  net30: 30,
  net60: 60,
};

/** Resolve a (possibly unknown) payment_terms value to a number of days. */
export function termDays(terms: string | null | undefined): number {
  return TERMS_DAYS[(terms ?? "immediate") as PaymentTermsKey] ?? 0;
}

export type AROrder = {
  total: number;
  payment_status: string; // anything other than "paid" counts as owed
  status?: string; // "cancelled" orders are excluded
  created_at: string; // ISO timestamp
};

export type ARBucket = "current" | "d1_30" | "d31_60" | "d60_plus";

export type Receivables = {
  /** All unpaid, non-cancelled order totals. */
  outstanding: number;
  /** Unpaid totals whose due date has already passed. */
  overdue: number;
  /** Unpaid totals not yet past their due date. */
  current: number;
  /** Outstanding money split by how far past due it is. */
  buckets: Record<ARBucket, number>;
  /** Days since the oldest overdue order became due; null when nothing overdue. */
  oldestOverdueDays: number | null;
  /** Number of unpaid orders. */
  count: number;
  /** Number of overdue orders. */
  overdueCount: number;
};

const DAY = 24 * 60 * 60 * 1000;

function emptyBuckets(): Record<ARBucket, number> {
  return { current: 0, d1_30: 0, d31_60: 0, d60_plus: 0 };
}

function bucketFor(daysOverdue: number): ARBucket {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "d1_30";
  if (daysOverdue <= 60) return "d31_60";
  return "d60_plus";
}

/**
 * Compute the receivables snapshot for one dealer's orders, given how many net
 * days their payment terms grant.
 */
export function computeReceivables(
  orders: AROrder[],
  days: number,
  opts: { now?: Date } = {}
): Receivables {
  const now = (opts.now ?? new Date()).getTime();
  const buckets = emptyBuckets();
  let outstanding = 0;
  let overdue = 0;
  let current = 0;
  let count = 0;
  let overdueCount = 0;
  let oldestOverdueDays: number | null = null;

  for (const o of orders) {
    if (o.status === "cancelled") continue;
    if (o.payment_status === "paid") continue;
    const total = Number(o.total) || 0;
    if (total <= 0) continue;

    count += 1;
    outstanding += total;

    const dueAt = new Date(o.created_at).getTime() + days * DAY;
    const daysOverdue = Math.floor((now - dueAt) / DAY);
    const bucket = bucketFor(daysOverdue);
    buckets[bucket] += total;

    if (daysOverdue > 0) {
      overdue += total;
      overdueCount += 1;
      if (oldestOverdueDays == null || daysOverdue > oldestOverdueDays) {
        oldestOverdueDays = daysOverdue;
      }
    } else {
      current += total;
    }
  }

  return { outstanding, overdue, current, buckets, oldestOverdueDays, count, overdueCount };
}

export type DealerReceivables = Receivables & { dealerId: string };

/**
 * Aggregate receivables per dealer for the admin AR view. `termsByDealer` maps
 * a dealer id to their net-days; missing dealers fall back to `defaultDays`.
 * Returns dealers with any outstanding balance, most-overdue first.
 */
export function computeReceivablesByDealer(
  orders: (AROrder & { dealer_id: string })[],
  termsByDealer: Record<string, number>,
  opts: { now?: Date; defaultDays?: number } = {}
): DealerReceivables[] {
  const defaultDays = opts.defaultDays ?? 0;
  const byDealer = new Map<string, (AROrder & { dealer_id: string })[]>();
  for (const o of orders) {
    const arr = byDealer.get(o.dealer_id) ?? [];
    arr.push(o);
    byDealer.set(o.dealer_id, arr);
  }

  const out: DealerReceivables[] = [];
  for (const [dealerId, list] of byDealer) {
    const days = termsByDealer[dealerId] ?? defaultDays;
    const r = computeReceivables(list, days, { now: opts.now });
    if (r.outstanding > 0) out.push({ dealerId, ...r });
  }

  // Worst first: most overdue money, then oldest, then biggest balance.
  return out.sort(
    (a, b) =>
      b.overdue - a.overdue ||
      (b.oldestOverdueDays ?? 0) - (a.oldestOverdueDays ?? 0) ||
      b.outstanding - a.outstanding
  );
}
