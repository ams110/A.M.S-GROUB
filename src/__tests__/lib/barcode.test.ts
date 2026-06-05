import { normalizeCode, matchProductByCode, type ScannableProduct } from "@/lib/barcode";

const products: ScannableProduct[] = [
  { id: "1", name_he: "מצלמת כיפה 4MP", sku: "TC-C32QN", slug: "tc-c32qn", barcode: "6921xx0012345" },
  { id: "2", name_he: "מקליט NVR 8CH", sku: "NVR-8CH-PRO", slug: "nvr-8ch", barcode: null },
  { id: "3", name_he: "כבל רשת CAT6", sku: "CAT6-305", slug: "cat6-305" },
];

describe("normalizeCode", () => {
  it("trims, removes whitespace and upper-cases", () => {
    expect(normalizeCode("  tc-c32qn \n")).toBe("TC-C32QN");
    expect(normalizeCode(null)).toBe("");
  });
});

describe("matchProductByCode", () => {
  it("matches an exact barcode regardless of case", () => {
    expect(matchProductByCode(products, "6921XX0012345")?.id).toBe("1");
  });

  it("matches an exact SKU", () => {
    expect(matchProductByCode(products, "nvr-8ch-pro")?.id).toBe("2");
  });

  it("matches by slug", () => {
    expect(matchProductByCode(products, "cat6-305")?.id).toBe("3");
  });

  it("falls back to a unique contains-match", () => {
    expect(matchProductByCode(products, "C32QN")?.id).toBe("1");
  });

  it("returns null on an ambiguous or empty code", () => {
    expect(matchProductByCode(products, "")).toBeNull();
    expect(matchProductByCode(products, "ZZZZZ")).toBeNull();
  });
});
