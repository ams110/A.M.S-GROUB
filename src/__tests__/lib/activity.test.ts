import { findDormantDealers, findDeadStock } from "@/lib/activity";

const NOW = new Date("2026-06-04T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("findDormantDealers", () => {
  it("flags a dealer who ordered on a cadence then went quiet", () => {
    // Ordered every ~10 days, last order 40 days ago → dormant.
    const orders = [
      { dealer_id: "a", created_at: daysAgo(70), total: 100 },
      { dealer_id: "a", created_at: daysAgo(60), total: 100 },
      { dealer_id: "a", created_at: daysAgo(50), total: 100 },
      { dealer_id: "a", created_at: daysAgo(40), total: 100 },
    ];
    const res = findDormantDealers(orders, { now: NOW });
    expect(res).toHaveLength(1);
    expect(res[0].dealerId).toBe("a");
    expect(res[0].daysSinceLast).toBe(40);
    expect(res[0].avgIntervalDays).toBe(10);
    expect(res[0].lifetimeSpend).toBe(400);
  });

  it("does not flag a dealer still within their normal cadence", () => {
    const orders = [
      { dealer_id: "b", created_at: daysAgo(60) },
      { dealer_id: "b", created_at: daysAgo(30) },
      { dealer_id: "b", created_at: daysAgo(5) }, // ~within 30d cadence
    ];
    expect(findDormantDealers(orders, { now: NOW })).toHaveLength(0);
  });

  it("ignores dealers with too few orders to infer a cadence", () => {
    const orders = [{ dealer_id: "c", created_at: daysAgo(200) }];
    expect(findDormantDealers(orders, { now: NOW })).toHaveLength(0);
  });

  it("excludes cancelled orders from the cadence", () => {
    const orders = [
      { dealer_id: "d", created_at: daysAgo(70), status: "cancelled" },
      { dealer_id: "d", created_at: daysAgo(40) },
    ];
    expect(findDormantDealers(orders, { now: NOW })).toHaveLength(0);
  });

  it("sorts most overdue first", () => {
    const orders = [
      // a: cadence 10, idle 60 → ratio 6
      { dealer_id: "a", created_at: daysAgo(80) },
      { dealer_id: "a", created_at: daysAgo(70) },
      { dealer_id: "a", created_at: daysAgo(60) },
      // e: cadence 20, idle 50 → ratio 2.5
      { dealer_id: "e", created_at: daysAgo(90) },
      { dealer_id: "e", created_at: daysAgo(70) },
      { dealer_id: "e", created_at: daysAgo(50) },
    ];
    const res = findDormantDealers(orders, { now: NOW });
    expect(res[0].dealerId).toBe("a");
  });
});

describe("findDeadStock", () => {
  const products = [
    { id: "p1", name_he: "מצלמה", stock: 10, cost: 50 },
    { id: "p2", name_he: "מקליט", stock: 5, cost: 200 },
    { id: "p3", name_he: "כבל", stock: 0, cost: 5 },
  ];

  it("flags in-stock products with no recent sales and ranks by frozen capital", () => {
    const orders = [{ id: "o1", created_at: daysAgo(120) }];
    const items = [{ order_id: "o1", product_id: "p1", qty: 1 }];
    // p1 last sold 120d ago (>60 stale), p2 never sold, p3 has no stock.
    const res = findDeadStock(products, orders, items, { now: NOW, staleDays: 60 });
    expect(res.map((d) => d.productId)).toEqual(["p2", "p1"]);
    expect(res[0].tiedCapital).toBe(1000); // 5 × 200
    expect(res[0].daysSinceSold).toBeNull();
    expect(res[1].daysSinceSold).toBe(120);
  });

  it("does not flag a product that sold inside the window", () => {
    const orders = [{ id: "o2", created_at: daysAgo(10) }];
    const items = [{ order_id: "o2", product_id: "p1", qty: 1 }];
    const res = findDeadStock(products, orders, items, { now: NOW, staleDays: 60 });
    expect(res.find((d) => d.productId === "p1")).toBeUndefined();
  });

  it("excludes cancelled orders when judging recency", () => {
    const orders = [{ id: "o3", created_at: daysAgo(10), status: "cancelled" }];
    const items = [{ order_id: "o3", product_id: "p1", qty: 1 }];
    const res = findDeadStock(products, orders, items, { now: NOW, staleDays: 60 });
    // The only "sale" was cancelled → p1 still counts as dead.
    expect(res.find((d) => d.productId === "p1")).toBeDefined();
  });
});
