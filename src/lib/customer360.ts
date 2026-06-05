/**
 * Customer 360° — pure logic (no React, no Supabase).
 *
 * One screen, the whole relationship. This composes the engines we already have
 * — receivables (ar), spend pulse (pulse), reorder cadence (reorder) — into a
 * single dossier for one customer, then derives a *risk* read on top: who is
 * late paying, who is drifting away, who is healthy. The admin Customer file
 * renders this; WhatsApp actions are chosen from the risk reasons.
 *
 * Deterministic and side-effect free for unit testing; `now` is injectable.
 */

import { computeReceivables, type AROrder, type Receivables } from "./ar";
import { computeDealerPulse, type PulseOrder, type DealerPulse } from "./pulse";
import {
  buildReorderSuggestions,
  type ReorderOrder,
  type ReorderItem,
  type ReorderSuggestion,
} from "./reorder";

export type RiskLevel = "high" | "medium" | "low";

export type CustomerRisk = {
  level: RiskLevel;
  /** 0–100; higher = needs attention sooner. */
  score: number;
  /** Human, Hebrew reasons driving the score (most important first). */
  reasons: string[];
};

export type Customer360 = {
  receivables: Receivables;
  pulse: DealerPulse;
  /** Top products this customer buys, by loyalty/recency. */
  topProducts: ReorderSuggestion[];
  risk: CustomerRisk;
};

export type Customer360Input = {
  /** Net days the customer's payment terms grant (from ar.termDays). */
  termDays: number;
  orders: (AROrder & PulseOrder & ReorderOrder)[];
  items: ReorderItem[];
  now?: Date;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Blend money risk (overdue, how old) with relationship risk (drifting away
 * relative to their own cadence) into one 0–100 score + reasons.
 */
export function computeCustomerRisk(
  receivables: Receivables,
  pulse: DealerPulse,
  topProducts: ReorderSuggestion[]
): CustomerRisk {
  let score = 0;
  const reasons: string[] = [];

  // ── Money: overdue balance and how stale it is ──────────────────────────
  if (receivables.overdue > 0) {
    score += 30;
    const days = receivables.oldestOverdueDays ?? 0;
    if (days > 60) score += 25;
    else if (days > 30) score += 15;
    else score += 5;
    reasons.push(
      days > 0
        ? `חוב באיחור — הוותיק ביותר ${days} ימים`
        : "קיים חוב באיחור"
    );
  } else if (receivables.outstanding > 0) {
    score += 5;
  }

  // ── Relationship: drifting away vs their own ordering cadence ────────────
  const cadence = mostFrequentCadence(topProducts);
  const idle = pulse.daysSinceLastOrder;
  if (idle != null) {
    if (cadence != null && cadence > 0 && idle > cadence * 1.5) {
      score += 30;
      reasons.push(`לא הזמין ${idle} ימים (בד״כ כל ~${Math.round(cadence)})`);
    } else if (idle > 60) {
      score += 25;
      reasons.push(`לא הזמין ${idle} ימים`);
    } else if (idle > 30) {
      score += 12;
      reasons.push(`לא הזמין ${idle} ימים`);
    }
  } else if (pulse.lifetimeOrders === 0) {
    score += 10;
    reasons.push("עדיין לא ביצע הזמנה");
  }

  // ── Momentum: spend dropping month-over-month ────────────────────────────
  if (pulse.spendDeltaPct != null && pulse.spendDeltaPct <= -40 && pulse.prevMonthSpend > 0) {
    score += 15;
    reasons.push(`ירידה של ${Math.abs(Math.round(pulse.spendDeltaPct))}% בהוצאה החודש`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: RiskLevel = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  if (reasons.length === 0) reasons.push("חשבון תקין — אין דגלים");
  return { level, score, reasons };
}

/** Median ordering cadence (days) across the customer's recurring products. */
function mostFrequentCadence(top: ReorderSuggestion[]): number | null {
  const cadences = top
    .map((s) => s.avgIntervalDays)
    .filter((d): d is number => d != null && d > 0)
    .sort((a, b) => a - b);
  if (cadences.length === 0) return null;
  return cadences[Math.floor(cadences.length / 2)];
}

export function buildCustomer360(input: Customer360Input): Customer360 {
  const now = input.now ?? new Date();
  const receivables = computeReceivables(input.orders, input.termDays, { now });
  const pulse = computeDealerPulse(input.orders, { now });
  const topProducts = buildReorderSuggestions(input.orders, input.items, { now }).slice(0, 6);
  const risk = computeCustomerRisk(receivables, pulse, topProducts);
  return { receivables, pulse, topProducts, risk };
}

export const RISK_LEVEL_HE: Record<RiskLevel, string> = {
  high: "סיכון גבוה",
  medium: "דורש תשומת לב",
  low: "תקין",
};

/** Days since an ISO timestamp, or null. Small shared helper for the UI. */
export function daysSince(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
}
