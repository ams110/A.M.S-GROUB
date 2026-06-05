/**
 * WhatsApp message templates — pure logic (no React, no Supabase).
 *
 * The onboarding flow already sends login details over wa.me; this generalises
 * that idea into a small library of Hebrew message builders (payment reminder,
 * quote, invoice, order confirmation) that all reuse the same `waLink` deep
 * link. One transport, many ready-to-send messages — the admin just taps send.
 */

import { formatPrice } from "./format";
import { waLink } from "./onboarding";

export { waLink, waPhone } from "./onboarding";

const SIGN = "— צוות Â.M.Ŝ GROUP";

/** Polite payment reminder for an overdue / outstanding balance. */
export function paymentReminderMessage(opts: {
  name?: string;
  amount: number;
  currency?: string;
  overdue?: number;
  oldestOverdueDays?: number | null;
  loginUrl?: string;
}): string {
  const hi = opts.name ? `שלום ${opts.name} 👋` : "שלום 👋";
  const lines = [hi, ""];

  if (opts.overdue && opts.overdue > 0) {
    const late =
      opts.oldestOverdueDays && opts.oldestOverdueDays > 0
        ? ` (החוב הוותיק ביותר באיחור של ${opts.oldestOverdueDays} ימים)`
        : "";
    lines.push(
      `רצינו להזכיר בנועם שקיימת יתרה לתשלום בסך ${formatPrice(opts.overdue, opts.currency)}${late}.`
    );
    if (opts.amount > opts.overdue) {
      lines.push(`סך כל היתרה הפתוחה בחשבון: ${formatPrice(opts.amount, opts.currency)}.`);
    }
  } else {
    lines.push(
      `רצינו להזכיר בנועם שקיימת יתרה פתוחה בחשבון בסך ${formatPrice(opts.amount, opts.currency)}.`
    );
  }

  if (opts.loginUrl) {
    lines.push("", `לצפייה בהזמנות ובחשבוניות: ${opts.loginUrl}`);
  }
  lines.push("", "נשמח להסדרת התשלום. תודה רבה! 🙏", SIGN);
  return lines.join("\n");
}

/** Notify a customer that a price quote is ready, with a link to view/accept. */
export function quoteMessage(opts: {
  name?: string;
  quoteNumber: string;
  total: number;
  currency?: string;
  validUntil?: string | null;
  viewUrl: string;
}): string {
  const hi = opts.name ? `שלום ${opts.name} 👋` : "שלום 👋";
  const lines = [
    hi,
    "",
    `הצעת מחיר ${opts.quoteNumber} מוכנה עבורך.`,
    `סכום: ${formatPrice(opts.total, opts.currency)} (לא כולל מע״מ).`,
  ];
  if (opts.validUntil) {
    lines.push(`בתוקף עד: ${new Date(opts.validUntil).toLocaleDateString("he-IL")}.`);
  }
  lines.push(
    "",
    `לצפייה ולאישור ההצעה בלחיצה אחת: ${opts.viewUrl}`,
    "",
    "נשמח לעמוד לרשותך 🤝",
    SIGN
  );
  return lines.join("\n");
}

/** Send a customer their tax invoice link. */
export function invoiceMessage(opts: {
  name?: string;
  invoiceNumber: string;
  total: number;
  currency?: string;
  viewUrl: string;
}): string {
  const hi = opts.name ? `שלום ${opts.name} 👋` : "שלום 👋";
  return [
    hi,
    "",
    `מצורפת חשבונית מס ${opts.invoiceNumber} על סך ${formatPrice(opts.total, opts.currency)}.`,
    `לצפייה והורדה: ${opts.viewUrl}`,
    "",
    "תודה על העסקת! 🤝",
    SIGN,
  ].join("\n");
}

/** Re-engage a dealer who hasn't ordered in a while. */
export function winBackMessage(opts: {
  name?: string;
  daysSinceLastOrder?: number | null;
  loginUrl?: string;
}): string {
  const hi = opts.name ? `שלום ${opts.name} 👋` : "שלום 👋";
  const gap =
    opts.daysSinceLastOrder && opts.daysSinceLastOrder > 0
      ? `שמנו לב שלא הזמנת כבר ${opts.daysSinceLastOrder} ימים — התגעגענו!`
      : "התגעגענו! מזמן לא התראינו.";
  const lines = [hi, "", gap, "הקטלוג מתעדכן כל הזמן עם מלאי ומחירים חדשים."];
  if (opts.loginUrl) lines.push("", `לכניסה לקטלוג: ${opts.loginUrl}`);
  lines.push("", "נשמח לראותך שוב 🤝", SIGN);
  return lines.join("\n");
}

/**
 * Proactive nudge: the customer is due to reorder items they buy on a cycle.
 * Lists their usual products (with the typical quantity) and a link to order.
 */
export function reorderReminderMessage(opts: {
  name?: string;
  products: { name_he: string; typicalQty?: number; avgIntervalDays?: number | null }[];
  loginUrl?: string;
}): string {
  const hi = opts.name ? `שלום ${opts.name} 👋` : "שלום 👋";
  const lines = [hi, "", "כנראה שהגיע הזמן לחדש מלאי של הפריטים שאתה מזמין בקביעות:"];
  for (const p of opts.products) {
    const qty = p.typicalQty && p.typicalQty > 0 ? ` — בערך ${p.typicalQty} יח׳` : "";
    lines.push(`• ${p.name_he}${qty}`);
  }
  if (opts.loginUrl) lines.push("", `להזמנה מהירה בקליק: ${opts.loginUrl}`);
  lines.push("", "נשמח לעמוד לרשותך 🤝", SIGN);
  return lines.join("\n");
}

/** Purchase order to send to a supplier (item list + quantities). */
export function purchaseOrderMessage(opts: {
  supplierName?: string;
  poNumber?: string | null;
  lines: { name: string; qty: number }[];
  notes?: string | null;
}): string {
  const hi = opts.supplierName ? `שלום ${opts.supplierName} 👋` : "שלום 👋";
  const lines = [hi, "", "נשמח להזמין את הפריטים הבאים:"];
  for (const l of opts.lines) lines.push(`• ${l.name} — ${l.qty} יח׳`);
  if (opts.poNumber) lines.push("", `מס׳ הזמנה: ${opts.poNumber}`);
  if (opts.notes) lines.push(`הערות: ${opts.notes}`);
  lines.push("", "תודה רבה! 🤝", SIGN);
  return lines.join("\n");
}

/** Build a wa.me link pre-filled with any of the messages above. */
export function waMessageLink(phone: string, message: string): string {
  return waLink(phone, message);
}
