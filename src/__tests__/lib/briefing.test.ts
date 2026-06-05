import { buildBriefing, greeting } from "@/lib/briefing";

const NOW = new Date("2026-06-05T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

describe("buildBriefing", () => {
  const base = {
    dealers: [
      { id: "d1", payment_terms: "immediate", status: "approved" },
      { id: "d2", payment_terms: "net30", status: "pending" },
    ],
    products: [
      { reorder_point: 10, stock: 3 },
      { reorder_point: 0, stock: 0 },
      { reorder_point: 5, stock: 2 },
    ],
    quotes: [{ status: "sent", valid_until: daysAgo(-2) }], // expires in 2 days
    now: NOW,
  };

  it("surfaces pending orders as urgent and first", () => {
    const orders = [
      { id: "o1", dealer_id: "d1", total: 100, payment_status: "unpaid", status: "pending", created_at: daysAgo(1) },
    ];
    const items = buildBriefing({ ...base, orders });
    expect(items[0].key).toBe("pending-orders");
    expect(items[0].severity).toBe("urgent");
  });

  it("reports overdue receivables with a total", () => {
    const orders = [
      { id: "o1", dealer_id: "d1", total: 5000, payment_status: "unpaid", status: "confirmed", created_at: daysAgo(40) },
    ];
    const items = buildBriefing({ ...base, orders });
    const overdue = items.find((i) => i.key === "overdue");
    expect(overdue).toBeDefined();
    expect(overdue!.count).toBe(1);
  });

  it("counts low-stock products that opted into reorder tracking", () => {
    const items = buildBriefing({ ...base, orders: [] });
    const low = items.find((i) => i.key === "low-stock");
    expect(low!.count).toBe(2);
  });

  it("flags pending dealer signups", () => {
    const items = buildBriefing({ ...base, orders: [] });
    expect(items.find((i) => i.key === "pending-dealers")?.count).toBe(1);
  });
});

describe("greeting", () => {
  it("varies by time of day", () => {
    expect(greeting(new Date("2026-06-05T08:00:00"))).toBe("בוקר טוב");
    expect(greeting(new Date("2026-06-05T14:00:00"))).toBe("צהריים טובים");
  });
});
