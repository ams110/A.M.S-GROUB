import {
  computeSalesVelocity,
  suggestReplenishment,
  type ReplenishProduct,
} from "@/lib/replenish";

const NOW = new Date("2026-06-04T00:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("computeSalesVelocity", () => {
  const orders = [
    { id: "o1", created_at: daysAgo(5) },
    { id: "o2", created_at: daysAgo(40) }, // outside a 30-day window
  ];
  const items = [
    { order_id: "o1", product_id: "A", qty: 30 },
    { order_id: "o2", product_id: "A", qty: 90 },
    { order_id: "o1", product_id: "B", qty: 15 },
  ];

  it("averages in-window quantities over the window length", () => {
    const v = computeSalesVelocity(orders, items, { windowDays: 30, now: NOW });
    expect(v.A).toBeCloseTo(1); // 30 units / 30 days; the 40-day-old order is excluded
    expect(v.B).toBeCloseTo(0.5);
  });

  it("ignores items with no product_id", () => {
    const v = computeSalesVelocity(
      orders,
      [{ order_id: "o1", product_id: null, qty: 99 }],
      { now: NOW }
    );
    expect(Object.keys(v)).toHaveLength(0);
  });
});

describe("suggestReplenishment", () => {
  const products: ReplenishProduct[] = [
    // Below reorder point, fast mover
    { id: "A", name_he: "מצלמה", stock: 5, reorder_point: 10, min_order_qty: 1, cost: 50 },
    // Below reorder point, no velocity data
    { id: "B", name_he: "כבל", stock: 2, reorder_point: 8, min_order_qty: 1, cost: 3 },
    // Healthy stock — should be excluded
    { id: "C", name_he: "מסך", stock: 100, reorder_point: 10, min_order_qty: 1, cost: 200 },
    // reorder_point 0 — opted out, excluded even if stock is 0
    { id: "D", name_he: "אקראי", stock: 0, reorder_point: 0, min_order_qty: 1, cost: 1 },
  ];

  it("only suggests low-stock, tracked products", () => {
    const out = suggestReplenishment(products, {}, {});
    expect(out.map((s) => s.product_id).sort()).toEqual(["A", "B"]);
  });

  it("sizes the order to cover velocity × (coverage + lead) minus stock", () => {
    // perDay 1, coverage 30 + lead 7 = 37 target; minus stock 5 → 32
    const out = suggestReplenishment(products, { A: 1 }, { coverageDays: 30, leadDays: 7 });
    const a = out.find((s) => s.product_id === "A")!;
    expect(a.suggestedQty).toBe(32);
    expect(a.daysLeft).toBe(5);
    expect(a.lineCost).toBe(32 * 50);
  });

  it("falls back to twice the reorder point when velocity is unknown", () => {
    const out = suggestReplenishment(products, {}, {});
    const b = out.find((s) => s.product_id === "B")!;
    // target = reorder_point * 2 = 16; minus stock 2 → 14
    expect(b.suggestedQty).toBe(14);
    expect(b.daysLeft).toBeNull();
  });

  it("never orders below the minimum order quantity", () => {
    const near: ReplenishProduct[] = [
      { id: "X", name_he: "כמעט", stock: 9, reorder_point: 10, min_order_qty: 12, cost: 1 },
    ];
    const out = suggestReplenishment(near, { X: 0.01 }, {});
    expect(out[0].suggestedQty).toBe(12);
  });

  it("orders the most urgent (soonest to run out) first", () => {
    const out = suggestReplenishment(products, { A: 1, B: 2 }, {});
    // B: 2 units / 2 per day = 1 day left; A: 5 days left → B first
    expect(out[0].product_id).toBe("B");
  });
});
