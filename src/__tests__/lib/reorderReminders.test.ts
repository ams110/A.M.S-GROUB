import { findReorderDueCustomers, type ReminderOrder } from "@/lib/reorderReminders";
import type { ReorderItem } from "@/lib/reorder";

const NOW = new Date("2026-06-05T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

// Dealer A ordered product P every ~14 days, last one 20 days ago → overdue.
const orders: ReminderOrder[] = [
  { id: "a1", dealer_id: "A", created_at: daysAgo(48) },
  { id: "a2", dealer_id: "A", created_at: daysAgo(34) },
  { id: "a3", dealer_id: "A", created_at: daysAgo(20) },
  // Dealer B ordered once recently → no cadence, not due.
  { id: "b1", dealer_id: "B", created_at: daysAgo(3) },
];

const items: ReorderItem[] = [
  { order_id: "a1", product_id: "P", name_he: "מצלמה", sku: "P", qty: 5, unit_price: 100 },
  { order_id: "a2", product_id: "P", name_he: "מצלמה", sku: "P", qty: 5, unit_price: 100 },
  { order_id: "a3", product_id: "P", name_he: "מצלמה", sku: "P", qty: 5, unit_price: 100 },
  { order_id: "b1", product_id: "Q", name_he: "כבל", sku: "Q", qty: 2, unit_price: 10 },
];

describe("findReorderDueCustomers", () => {
  it("flags a customer overdue for a recurring product", () => {
    const due = findReorderDueCustomers(orders, items, { now: NOW });
    expect(due).toHaveLength(1);
    expect(due[0].dealerId).toBe("A");
    expect(due[0].dueProducts[0].product_id).toBe("P");
    expect(due[0].dueProducts[0].typicalQty).toBe(5);
    expect(due[0].topDueScore).toBeGreaterThanOrEqual(1);
  });

  it("ignores one-off buyers with no cadence", () => {
    const due = findReorderDueCustomers(orders, items, { now: NOW });
    expect(due.find((d) => d.dealerId === "B")).toBeUndefined();
  });

  it("excludes cancelled orders", () => {
    const withCancel: ReminderOrder[] = orders.map((o) =>
      o.id === "a3" ? { ...o, status: "cancelled" } : o
    );
    const due = findReorderDueCustomers(withCancel, items, { now: NOW });
    // Only two non-cancelled orders remain; last is 34d ago, cadence ~14 → still due
    expect(due[0]?.dealerId).toBe("A");
  });

  it("respects a higher threshold (don't nudge early)", () => {
    const due = findReorderDueCustomers(orders, items, { now: NOW, threshold: 3 });
    expect(due).toHaveLength(0);
  });
});
