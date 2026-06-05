import { buildCustomer360, computeCustomerRisk } from "@/lib/customer360";
import { computeReceivables } from "@/lib/ar";
import { computeDealerPulse } from "@/lib/pulse";

const NOW = new Date("2026-06-05T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

describe("computeCustomerRisk", () => {
  it("flags high risk for stale overdue debt", () => {
    const ar = computeReceivables(
      [{ total: 5000, payment_status: "unpaid", created_at: daysAgo(90) }],
      0,
      { now: NOW }
    );
    const pulse = computeDealerPulse(
      [{ total: 5000, status: "confirmed", created_at: daysAgo(90) }],
      { now: NOW }
    );
    const risk = computeCustomerRisk(ar, pulse, []);
    expect(risk.level).toBe("high");
    expect(risk.reasons.join(" ")).toMatch(/איחור/);
  });

  it("reports a healthy account as low risk", () => {
    const ar = computeReceivables(
      [{ total: 1000, payment_status: "paid", created_at: daysAgo(5) }],
      30,
      { now: NOW }
    );
    const pulse = computeDealerPulse(
      [{ total: 1000, status: "paid", created_at: daysAgo(5) }],
      { now: NOW }
    );
    const risk = computeCustomerRisk(ar, pulse, []);
    expect(risk.level).toBe("low");
  });
});

describe("buildCustomer360", () => {
  it("composes receivables, pulse and top products", () => {
    const orders = [
      { id: "o1", total: 1200, payment_status: "unpaid", status: "confirmed", created_at: daysAgo(40) },
      { id: "o2", total: 800, payment_status: "paid", status: "paid", created_at: daysAgo(10) },
    ];
    const items = [
      { order_id: "o1", product_id: "p1", name_he: "מצלמה", sku: "A", qty: 3, unit_price: 100 },
      { order_id: "o2", product_id: "p1", name_he: "מצלמה", sku: "A", qty: 2, unit_price: 100 },
    ];
    const dossier = buildCustomer360({ termDays: 30, orders, items, now: NOW });
    expect(dossier.receivables.outstanding).toBe(1200);
    expect(dossier.pulse.lifetimeOrders).toBe(2);
    expect(dossier.topProducts[0]?.product_id).toBe("p1");
    expect(dossier.topProducts[0]?.timesOrdered).toBe(2);
  });
});
