import {
  buildReorderSuggestions,
  isDue,
  median,
  type ReorderItem,
  type ReorderOrder,
} from "@/lib/reorder";

const NOW = new Date("2026-06-04T00:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("median", () => {
  it("returns 0 for empty input", () => {
    expect(median([])).toBe(0);
  });
  it("handles odd length", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("averages the two middle values for even length", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("buildReorderSuggestions", () => {
  const orders: ReorderOrder[] = [
    { id: "o1", created_at: daysAgo(60) },
    { id: "o2", created_at: daysAgo(30) },
    { id: "o3", created_at: daysAgo(2) },
  ];

  const items: ReorderItem[] = [
    // Product A — ordered in all 3 orders, typical qty 2
    { order_id: "o1", product_id: "A", name_he: "מצלמה", sku: "CAM-1", qty: 2, unit_price: 100 },
    { order_id: "o2", product_id: "A", name_he: "מצלמה", sku: "CAM-1", qty: 2, unit_price: 110 },
    { order_id: "o3", product_id: "A", name_he: "מצלמה", sku: "CAM-1", qty: 4, unit_price: 120 },
    // Product B — ordered once, long ago
    { order_id: "o1", product_id: "B", name_he: "כבל", sku: "CBL", qty: 5, unit_price: 10 },
  ];

  it("aggregates frequency, total qty and typical (median) qty", () => {
    const [a] = buildReorderSuggestions(orders, items, { now: NOW }).filter(
      (s) => s.product_id === "A"
    );
    expect(a.timesOrdered).toBe(3);
    expect(a.totalQty).toBe(8);
    expect(a.typicalQty).toBe(2); // median of [2,2,4]
  });

  it("uses the most recent unit price and last-ordered date", () => {
    const a = buildReorderSuggestions(orders, items, { now: NOW }).find(
      (s) => s.product_id === "A"
    )!;
    expect(a.lastUnitPrice).toBe(120);
    expect(a.daysSinceLast).toBe(2);
  });

  it("ranks a frequently/recently ordered product above a one-off", () => {
    const sorted = buildReorderSuggestions(orders, items, { now: NOW });
    expect(sorted[0].product_id).toBe("A");
    expect(sorted[1].product_id).toBe("B");
  });

  it("computes average interval only when ordered 2+ times", () => {
    const list = buildReorderSuggestions(orders, items, { now: NOW });
    const a = list.find((s) => s.product_id === "A")!;
    const b = list.find((s) => s.product_id === "B")!;
    expect(a.avgIntervalDays).toBe(29); // (60-2)/2 days span over 2 gaps
    expect(b.avgIntervalDays).toBeNull();
  });

  it("ranks the more recent of two equally-frequent products higher", () => {
    const o = [
      { id: "x1", created_at: daysAgo(40) },
      { id: "x2", created_at: daysAgo(35) },
      { id: "y1", created_at: daysAgo(10) },
      { id: "y2", created_at: daysAgo(5) },
    ];
    const i: ReorderItem[] = [
      { order_id: "x1", product_id: "OLD", name_he: "ישן", sku: null, qty: 1, unit_price: 1 },
      { order_id: "x2", product_id: "OLD", name_he: "ישן", sku: null, qty: 1, unit_price: 1 },
      { order_id: "y1", product_id: "NEW", name_he: "חדש", sku: null, qty: 1, unit_price: 1 },
      { order_id: "y2", product_id: "NEW", name_he: "חדש", sku: null, qty: 1, unit_price: 1 },
    ];
    const sorted = buildReorderSuggestions(o, i, { now: NOW });
    expect(sorted[0].product_id).toBe("NEW");
  });

  it("skips items with no product_id or an unknown order", () => {
    const i: ReorderItem[] = [
      { order_id: "o1", product_id: null, name_he: "נמחק", sku: null, qty: 1, unit_price: 1 },
      { order_id: "ghost", product_id: "C", name_he: "רפאים", sku: null, qty: 1, unit_price: 1 },
    ];
    expect(buildReorderSuggestions(orders, i, { now: NOW })).toHaveLength(0);
  });

  it("merges multiple lines of the same product within one order", () => {
    const i: ReorderItem[] = [
      { order_id: "o3", product_id: "A", name_he: "מצלמה", sku: null, qty: 1, unit_price: 100 },
      { order_id: "o3", product_id: "A", name_he: "מצלמה", sku: null, qty: 3, unit_price: 100 },
    ];
    const a = buildReorderSuggestions(orders, i, { now: NOW })[0];
    expect(a.timesOrdered).toBe(1);
    expect(a.typicalQty).toBe(4); // 1 + 3 summed in the same order
  });
});

describe("isDue", () => {
  it("flags an overdue cyclic product", () => {
    const orders: ReorderOrder[] = [
      { id: "o1", created_at: daysAgo(60) },
      { id: "o2", created_at: daysAgo(30) },
    ];
    // last ordered 30 days ago, cadence ~30 days → due
    const items: ReorderItem[] = [
      { order_id: "o1", product_id: "A", name_he: "x", sku: null, qty: 1, unit_price: 1 },
      { order_id: "o2", product_id: "A", name_he: "x", sku: null, qty: 1, unit_price: 1 },
    ];
    const a = buildReorderSuggestions(orders, items, { now: NOW })[0];
    expect(isDue(a)).toBe(true);
  });

  it("does not flag a product ordered only once", () => {
    const orders: ReorderOrder[] = [{ id: "o1", created_at: daysAgo(2) }];
    const items: ReorderItem[] = [
      { order_id: "o1", product_id: "A", name_he: "x", sku: null, qty: 1, unit_price: 1 },
    ];
    const a = buildReorderSuggestions(orders, items, { now: NOW })[0];
    expect(isDue(a)).toBe(false);
  });
});
