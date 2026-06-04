import { computeDealerPulse, type PulseOrder } from "@/lib/pulse";

// Mid-month so "this month" and "last month" are unambiguous.
const NOW = new Date("2026-06-15T12:00:00Z");
const at = (iso: string): string => new Date(iso).toISOString();

describe("computeDealerPulse", () => {
  const orders: PulseOrder[] = [
    { total: 1000, status: "paid", created_at: at("2026-06-10") }, // this month
    { total: 500, status: "confirmed", created_at: at("2026-06-02") }, // this month
    { total: 800, status: "paid", created_at: at("2026-05-20") }, // last month
    { total: 9999, status: "cancelled", created_at: at("2026-06-12") }, // ignored
    { total: 300, status: "delivered", created_at: at("2026-03-01") }, // older
  ];

  it("sums spend for the current calendar month, excluding cancelled", () => {
    const p = computeDealerPulse(orders, { now: NOW });
    expect(p.monthSpend).toBe(1500);
    expect(p.monthOrders).toBe(2);
  });

  it("sums the previous calendar month separately", () => {
    const p = computeDealerPulse(orders, { now: NOW });
    expect(p.prevMonthSpend).toBe(800);
  });

  it("computes the month-over-month delta", () => {
    const p = computeDealerPulse(orders, { now: NOW });
    // (1500 - 800) / 800 = 87.5%
    expect(p.spendDeltaPct).toBeCloseTo(87.5);
  });

  it("computes lifetime totals and average order value (excluding cancelled)", () => {
    const p = computeDealerPulse(orders, { now: NOW });
    expect(p.lifetimeOrders).toBe(4);
    expect(p.lifetimeSpend).toBe(2600);
    expect(p.avgOrderValue).toBe(650);
  });

  it("reports the most recent committed order date", () => {
    const p = computeDealerPulse(orders, { now: NOW });
    expect(p.lastOrderAt).toBe(at("2026-06-10"));
    expect(p.daysSinceLastOrder).toBe(5);
  });

  it("reports +100% (all new) when last month had no spend but this month does", () => {
    // Mirrors the OpsCenter pctDelta convention used across the app.
    const p = computeDealerPulse(
      [{ total: 100, status: "paid", created_at: at("2026-06-10") }],
      { now: NOW }
    );
    expect(p.spendDeltaPct).toBe(100);
  });

  it("returns null delta when there is no spend in either month", () => {
    const p = computeDealerPulse(
      [{ total: 300, status: "paid", created_at: at("2026-03-01") }],
      { now: NOW }
    );
    expect(p.spendDeltaPct).toBeNull();
  });

  it("handles an empty history gracefully", () => {
    const p = computeDealerPulse([], { now: NOW });
    expect(p.lifetimeOrders).toBe(0);
    expect(p.avgOrderValue).toBe(0);
    expect(p.lastOrderAt).toBeNull();
    expect(p.daysSinceLastOrder).toBeNull();
  });
});
