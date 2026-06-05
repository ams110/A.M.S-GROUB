import { computeMargin, applyPctChange, priceFromMarkup } from "@/lib/margin";

describe("computeMargin", () => {
  it("computes profit and margin %", () => {
    const m = computeMargin(100, 60);
    expect(m.profit).toBe(40);
    expect(m.marginPct).toBeCloseTo(40);
    expect(m.belowCost).toBe(false);
    expect(m.thin).toBe(false);
    expect(m.known).toBe(true);
  });

  it("flags selling below cost", () => {
    const m = computeMargin(50, 80);
    expect(m.profit).toBe(-30);
    expect(m.belowCost).toBe(true);
  });

  it("flags thin margins under the threshold", () => {
    const m = computeMargin(105, 100); // ~4.8%
    expect(m.thin).toBe(true);
    expect(m.belowCost).toBe(false);
  });

  it("respects a custom thin threshold", () => {
    const m = computeMargin(130, 100, { thinThresholdPct: 40 }); // ~23%
    expect(m.thin).toBe(true);
  });

  it("treats unknown cost (0) as not flaggable", () => {
    const m = computeMargin(100, 0);
    expect(m.known).toBe(false);
    expect(m.belowCost).toBe(false);
    expect(m.thin).toBe(false);
  });

  it("handles a zero price safely", () => {
    const m = computeMargin(0, 50);
    expect(m.marginPct).toBe(0);
    expect(m.belowCost).toBe(false); // no real price set yet
  });
});

describe("applyPctChange", () => {
  it("raises and lowers prices", () => {
    expect(applyPctChange(100, 5)).toBe(105);
    expect(applyPctChange(100, -10)).toBe(90);
  });
  it("rounds to 2 decimals and never goes negative", () => {
    expect(applyPctChange(33.337, 0)).toBe(33.34);
    expect(applyPctChange(100, -250)).toBe(0);
  });
});

describe("priceFromMarkup", () => {
  it("marks up from cost", () => {
    expect(priceFromMarkup(100, 25)).toBe(125);
    expect(priceFromMarkup(80, 50)).toBe(120);
  });
});
