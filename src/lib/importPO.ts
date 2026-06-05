/**
 * Purchase-order import — pure logic (no React, no Supabase, no file parsing).
 *
 * Takes already-parsed spreadsheet rows (array of objects keyed by header) plus
 * a column mapping, resolves each row to a catalogue product, and produces
 * purchase-order lines (product_id + qty + unit_cost). Unmatched rows are kept
 * so the UI can show what didn't resolve.
 *
 * Matching reuses the forgiving barcode/SKU resolver; a name column falls back
 * to an exact-then-unique-contains match on the Hebrew name.
 *
 * Deterministic and side-effect free so it can be unit tested without a file.
 */

import { matchProductByCode, normalizeCode, type ScannableProduct } from "./barcode";

export type ImportRow = Record<string, string | number | null | undefined>;

/** Which spreadsheet columns map to which fields. */
export type ColumnMap = {
  /** Column holding the product key (sku / barcode / name). */
  match: string;
  /** How to interpret the match column. "auto" tries code first, then name. */
  matchBy: "auto" | "sku" | "barcode" | "name";
  /** Column holding the unit cost. */
  cost: string;
  /** Optional column holding the quantity (defaults to 1 when absent/invalid). */
  qty?: string;
};

export type ImportLine = {
  /** Resolved product id, or "" when nothing matched. */
  product_id: string;
  /** Resolved product name (or the raw cell when unmatched) — for display. */
  name_he: string;
  qty: number;
  unit_cost: number;
  /** The raw value from the match column, for the preview. */
  rawMatch: string;
  matched: boolean;
};

export type ImportResult = {
  lines: ImportLine[];
  matchedCount: number;
  unmatchedCount: number;
};

/** Parse a possibly-formatted number cell ("1,234.5" / "₪80" / 80) → number. */
export function parseNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").replace(/[^\d.,-]/g, "").replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function matchByName<T extends ScannableProduct>(products: T[], raw: string): T | null {
  const code = normalizeCode(raw);
  if (!code) return null;
  const exact = products.find((p) => normalizeCode(p.name_he) === code);
  if (exact) return exact;
  const loose = products.filter(
    (p) => code.length >= 4 && normalizeCode(p.name_he).includes(code)
  );
  return loose.length === 1 ? loose[0] : null;
}

/**
 * Build purchase-order lines from spreadsheet rows. Rows with no match value are
 * skipped entirely; rows that don't resolve to a product are returned as
 * unmatched (so the admin can fix the sheet or the catalogue).
 */
export function buildImportLines<T extends ScannableProduct>(
  rows: ImportRow[],
  map: ColumnMap,
  products: T[]
): ImportResult {
  const lines: ImportLine[] = [];

  for (const row of rows) {
    const rawMatch = String(row[map.match] ?? "").trim();
    if (!rawMatch) continue; // blank key → ignore the row

    const cost = parseNumber(row[map.cost]);
    const qtyRaw = map.qty ? parseNumber(row[map.qty]) : 1;
    const qty = qtyRaw > 0 ? qtyRaw : 1;

    let product: T | null = null;
    if (map.matchBy === "name") product = matchByName(products, rawMatch);
    else if (map.matchBy === "sku" || map.matchBy === "barcode" || map.matchBy === "auto")
      product = matchProductByCode(products, rawMatch);
    // "auto": fall back to a name match when the code resolver found nothing.
    if (!product && map.matchBy === "auto") product = matchByName(products, rawMatch);

    lines.push(
      product
        ? { product_id: product.id, name_he: product.name_he, qty, unit_cost: cost, rawMatch, matched: true }
        : { product_id: "", name_he: rawMatch, qty, unit_cost: cost, rawMatch, matched: false }
    );
  }

  const matchedCount = lines.filter((l) => l.matched).length;
  return { lines, matchedCount, unmatchedCount: lines.length - matchedCount };
}
