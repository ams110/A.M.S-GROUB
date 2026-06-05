import {
  paymentReminderMessage,
  quoteMessage,
  invoiceMessage,
  winBackMessage,
  reorderReminderMessage,
  waMessageLink,
  waPhone,
} from "@/lib/messages";

describe("paymentReminderMessage", () => {
  it("mentions the overdue amount and age", () => {
    const msg = paymentReminderMessage({
      name: "דוד",
      amount: 1000,
      overdue: 600,
      oldestOverdueDays: 12,
    });
    expect(msg).toContain("דוד");
    expect(msg).toContain("12 ימים");
    expect(msg).toMatch(/600/);
  });

  it("falls back to the total outstanding when nothing is overdue", () => {
    const msg = paymentReminderMessage({ amount: 500, overdue: 0 });
    expect(msg).toMatch(/500/);
    expect(msg).not.toContain("איחור");
  });
});

describe("quoteMessage", () => {
  it("includes the quote number and a view link", () => {
    const msg = quoteMessage({
      name: "אבי",
      quoteNumber: "Q-1001",
      total: 2500,
      viewUrl: "https://x/quote?id=1",
      validUntil: "2026-07-01",
    });
    expect(msg).toContain("Q-1001");
    expect(msg).toContain("https://x/quote?id=1");
    expect(msg).toMatch(/2,?500/);
  });
});

describe("invoiceMessage", () => {
  it("includes the invoice number and link", () => {
    const msg = invoiceMessage({
      invoiceNumber: "INV-9",
      total: 100,
      viewUrl: "https://x/invoice?order=9",
    });
    expect(msg).toContain("INV-9");
    expect(msg).toContain("https://x/invoice?order=9");
  });
});

describe("winBackMessage", () => {
  it("mentions the idle gap when known", () => {
    const msg = winBackMessage({ name: "רני", daysSinceLastOrder: 45 });
    expect(msg).toContain("45 ימים");
  });
});

describe("waMessageLink", () => {
  it("builds a wa.me link with an Israeli number and encoded text", () => {
    const link = waMessageLink("050-1234567", "שלום עולם");
    expect(link).toContain("https://wa.me/972501234567");
    expect(link).toContain(encodeURIComponent("שלום עולם"));
  });
  it("re-exports waPhone", () => {
    expect(waPhone("0501234567")).toBe("972501234567");
  });
});

describe("reorderReminderMessage", () => {
  it("lists the customer's usual products with quantities", () => {
    const msg = reorderReminderMessage({
      name: "דנה",
      products: [
        { name_he: "מצלמת כיפה", typicalQty: 5 },
        { name_he: "כבל רשת", typicalQty: 10 },
      ],
      loginUrl: "https://example.com/",
    });
    expect(msg).toContain("דנה");
    expect(msg).toContain("מצלמת כיפה");
    expect(msg).toContain("5 יח׳");
    expect(msg).toContain("https://example.com/");
  });
});
