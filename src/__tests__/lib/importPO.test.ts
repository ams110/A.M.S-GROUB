import { buildImportLines, parseNumber, type ImportRow } from "@/lib/importPO";
import type { ScannableProduct } from "@/lib/barcode";

const PRODUCTS: ScannableProduct[] = [
  { id: "p1", name_he: "מצלמה כיפה 4MP", sku: "TC-D1", slug: "dome-4mp", barcode: "1111111111111" },
  { id: "p2", name_he: "מצלמה בולט 8MP", sku: "TC-B8", slug: "bullet-8mp", barcode: "2222222222222" },
];

describe("parseNumber", () => {
  it("parses plain numbers and formatted strings", () => {
    expect(parseNumber(80)).toBe(80);
    expect(parseNumber("₪1,234.5")).toBe(1234.5);
    expect(parseNumber("")).toBe(0);
    expect(parseNumber(null)).toBe(0);
  });
});

describe("buildImportLines", () => {
  it("matches by SKU and reads cost + qty", () => {
    const rows: ImportRow[] = [{ sku: "TC-D1", cost: "80", qty: "5" }];
    const r = buildImportLines(rows, { match: "sku", matchBy: "sku", cost: "cost", qty: "qty" }, PRODUCTS);
    expect(r.matchedCount).toBe(1);
    expect(r.lines[0]).toMatchObject({ product_id: "p1", qty: 5, unit_cost: 80, matched: true });
  });

  it("matches by barcode", () => {
    const rows: ImportRow[] = [{ code: "2222222222222", price: 120 }];
    const r = buildImportLines(rows, { match: "code", matchBy: "barcode", cost: "price" }, PRODUCTS);
    expect(r.lines[0].product_id).toBe("p2");
    expect(r.lines[0].qty).toBe(1); // no qty column → defaults to 1
  });

  it("auto-falls back to a name match when the code resolver misses", () => {
    const rows: ImportRow[] = [{ item: "מצלמה בולט 8MP", cost: 100 }];
    const r = buildImportLines(rows, { match: "item", matchBy: "auto", cost: "cost" }, PRODUCTS);
    expect(r.lines[0].product_id).toBe("p2");
  });

  it("keeps unmatched rows flagged", () => {
    const rows: ImportRow[] = [{ sku: "DOES-NOT-EXIST", cost: 10 }];
    const r = buildImportLines(rows, { match: "sku", matchBy: "sku", cost: "cost" }, PRODUCTS);
    expect(r.matchedCount).toBe(0);
    expect(r.unmatchedCount).toBe(1);
    expect(r.lines[0]).toMatchObject({ product_id: "", matched: false, rawMatch: "DOES-NOT-EXIST" });
  });

  it("skips rows with a blank match key", () => {
    const rows: ImportRow[] = [{ sku: "", cost: 10 }, { sku: "TC-D1", cost: 80 }];
    const r = buildImportLines(rows, { match: "sku", matchBy: "sku", cost: "cost" }, PRODUCTS);
    expect(r.lines).toHaveLength(1);
  });
});
