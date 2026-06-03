import {
  formatPrice,
  ORDER_STATUS_HE,
  PAYMENT_METHOD_HE,
  PAYMENT_STATUS_HE,
  PROFILE_STATUS_HE,
  CUSTOMER_TYPE_HE,
  PAYMENT_TERMS_HE,
} from "@/lib/format";

describe("formatPrice", () => {
  it("formats ILS with Hebrew locale", () => {
    const result = formatPrice(1500, "ILS");
    expect(result).toContain("1,500");
  });

  it("defaults to ILS when no currency provided", () => {
    const result = formatPrice(200);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns zero correctly", () => {
    const result = formatPrice(0, "ILS");
    expect(result).toContain("0");
  });

  it("handles large numbers", () => {
    const result = formatPrice(1000000, "ILS");
    expect(result).toContain("1,000,000");
  });

  it("falls back gracefully on unknown currency", () => {
    // An unknown currency code should fall back to "value currency"
    const result = formatPrice(500, "XXX");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});

describe("ORDER_STATUS_HE", () => {
  it("covers all order statuses", () => {
    const statuses = ["pending", "confirmed", "paid", "shipped", "delivered", "cancelled"];
    statuses.forEach((s) => {
      expect(ORDER_STATUS_HE[s]).toBeTruthy();
    });
  });

  it("returns Hebrew strings", () => {
    // Hebrew characters are in Unicode range א-ת
    Object.values(ORDER_STATUS_HE).forEach((val) => {
      expect(/[א-ת]/.test(val)).toBe(true);
    });
  });
});

describe("PAYMENT_METHOD_HE", () => {
  it("covers card, bank_transfer, cod", () => {
    expect(PAYMENT_METHOD_HE.card).toBeTruthy();
    expect(PAYMENT_METHOD_HE.bank_transfer).toBeTruthy();
    expect(PAYMENT_METHOD_HE.cod).toBeTruthy();
  });
});

describe("PAYMENT_STATUS_HE", () => {
  it("covers unpaid, paid, refunded", () => {
    expect(PAYMENT_STATUS_HE.unpaid).toBeTruthy();
    expect(PAYMENT_STATUS_HE.paid).toBeTruthy();
    expect(PAYMENT_STATUS_HE.refunded).toBeTruthy();
  });
});

describe("PROFILE_STATUS_HE", () => {
  it("covers pending, approved, rejected", () => {
    expect(PROFILE_STATUS_HE.pending).toBeTruthy();
    expect(PROFILE_STATUS_HE.approved).toBeTruthy();
    expect(PROFILE_STATUS_HE.rejected).toBeTruthy();
  });
});

describe("CUSTOMER_TYPE_HE", () => {
  it("covers dealer and contractor", () => {
    expect(CUSTOMER_TYPE_HE.dealer).toBeTruthy();
    expect(CUSTOMER_TYPE_HE.contractor).toBeTruthy();
  });
});

describe("PAYMENT_TERMS_HE", () => {
  it("covers immediate, net30, net60", () => {
    expect(PAYMENT_TERMS_HE.immediate).toBeTruthy();
    expect(PAYMENT_TERMS_HE.net30).toBeTruthy();
    expect(PAYMENT_TERMS_HE.net60).toBeTruthy();
  });
});
