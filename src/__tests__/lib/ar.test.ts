import {
  termDays,
  computeReceivables,
  computeReceivablesByDealer,
  TERMS_DAYS,
} from "@/lib/ar";

const NOW = new Date("2026-06-04T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("termDays", () => {
  it("maps known terms to net days", () => {
    expect(termDays("immediate")).toBe(0);
    expect(termDays("net30")).toBe(30);
    expect(termDays("net60")).toBe(60);
  });
  it("falls back to 0 for unknown/empty terms", () => {
    expect(termDays(null)).toBe(0);
    expect(termDays(undefined)).toBe(0);
    expect(termDays("weird")).toBe(0);
  });
  it("matches the TERMS_DAYS table", () => {
    expect(TERMS_DAYS.net30).toBe(30);
  });
});

describe("computeReceivables", () => {
  it("returns zeros for no orders", () => {
    const r = computeReceivables([], 30, { now: NOW });
    expect(r.outstanding).toBe(0);
    expect(r.overdue).toBe(0);
    expect(r.oldestOverdueDays).toBeNull();
    expect(r.count).toBe(0);
  });

  it("excludes paid and cancelled orders", () => {
    const r = computeReceivables(
      [
        { total: 100, payment_status: "paid", created_at: daysAgo(100) },
        { total: 200, payment_status: "unpaid", status: "cancelled", created_at: daysAgo(100) },
        { total: 50, payment_status: "unpaid", created_at: daysAgo(1) },
      ],
      0,
      { now: NOW }
    );
    expect(r.outstanding).toBe(50);
    expect(r.count).toBe(1);
  });

  it("classifies an immediate-term order as overdue the day after", () => {
    const r = computeReceivables(
      [{ total: 100, payment_status: "unpaid", created_at: daysAgo(2) }],
      0,
      { now: NOW }
    );
    expect(r.overdue).toBe(100);
    expect(r.current).toBe(0);
    expect(r.oldestOverdueDays).toBe(2);
    expect(r.overdueCount).toBe(1);
  });

  it("respects net30 — within terms is current, beyond is overdue", () => {
    const within = computeReceivables(
      [{ total: 100, payment_status: "unpaid", created_at: daysAgo(10) }],
      30,
      { now: NOW }
    );
    expect(within.current).toBe(100);
    expect(within.overdue).toBe(0);

    const beyond = computeReceivables(
      [{ total: 100, payment_status: "unpaid", created_at: daysAgo(45) }],
      30,
      { now: NOW }
    );
    expect(beyond.overdue).toBe(100);
    expect(beyond.oldestOverdueDays).toBe(15);
  });

  it("splits money into aging buckets", () => {
    const r = computeReceivables(
      [
        { total: 10, payment_status: "unpaid", created_at: daysAgo(5) }, // current
        { total: 20, payment_status: "unpaid", created_at: daysAgo(40) }, // 1-30 over
        { total: 30, payment_status: "unpaid", created_at: daysAgo(75) }, // 31-60 over
        { total: 40, payment_status: "unpaid", created_at: daysAgo(120) }, // 60+ over
      ],
      30,
      { now: NOW }
    );
    expect(r.buckets.current).toBe(10);
    expect(r.buckets.d1_30).toBe(20);
    expect(r.buckets.d31_60).toBe(30);
    expect(r.buckets.d60_plus).toBe(40);
    expect(r.outstanding).toBe(100);
    expect(r.overdue).toBe(90);
  });
});

describe("computeReceivablesByDealer", () => {
  it("aggregates per dealer and sorts most-overdue first", () => {
    const orders = [
      { dealer_id: "a", total: 100, payment_status: "unpaid", created_at: daysAgo(5) },
      { dealer_id: "b", total: 500, payment_status: "unpaid", created_at: daysAgo(90) },
      { dealer_id: "c", total: 80, payment_status: "paid", created_at: daysAgo(90) },
    ];
    const res = computeReceivablesByDealer(orders, { a: 30, b: 30 }, { now: NOW });
    // c is fully paid → excluded; b is overdue → first.
    expect(res.map((r) => r.dealerId)).toEqual(["b", "a"]);
    expect(res[0].overdue).toBe(500);
    expect(res[1].overdue).toBe(0);
  });

  it("uses defaultDays when a dealer's terms are missing", () => {
    const orders = [
      { dealer_id: "x", total: 100, payment_status: "unpaid", created_at: daysAgo(10) },
    ];
    const immediate = computeReceivablesByDealer(orders, {}, { now: NOW, defaultDays: 0 });
    expect(immediate[0].overdue).toBe(100);
    const net30 = computeReceivablesByDealer(orders, {}, { now: NOW, defaultDays: 30 });
    expect(net30[0].overdue).toBe(0);
  });
});
