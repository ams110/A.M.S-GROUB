/**
 * Barcode / QR matching — pure logic (no React, no Supabase, no camera).
 *
 * The camera layer (BarcodeScanner component) hands us a raw scanned string;
 * this module normalises it and resolves it to a catalogue product. Matching is
 * deliberately forgiving: dealers scan the EAN/UPC printed on the box, the
 * manufacturer model, or our own SKU, so we try barcode → SKU → slug, exact
 * first then a loose contains-match, and ignore case / surrounding whitespace.
 *
 * Deterministic and side-effect free so it can be unit tested without a camera.
 */

export type ScannableProduct = {
  id: string;
  name_he: string;
  sku: string | null;
  slug: string;
  /** Optional EAN/UPC stored on the product (may be absent on older rows). */
  barcode?: string | null;
};

/** Strip whitespace and upper-case; scanners sometimes emit trailing newlines. */
export function normalizeCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

/** Does a product field equal the scanned code (normalised)? */
function eq(field: string | null | undefined, code: string): boolean {
  return !!field && normalizeCode(field) === code;
}

/** Does a product field contain the scanned code (normalised, ≥4 chars)? */
function contains(field: string | null | undefined, code: string): boolean {
  return !!field && code.length >= 4 && normalizeCode(field).includes(code);
}

/**
 * Resolve a scanned code to a single product, or null when nothing matches.
 * Exact barcode/SKU/slug wins; only then do we fall back to a contains-match
 * (and only when it's unambiguous — a single hit).
 */
export function matchProductByCode<T extends ScannableProduct>(
  products: T[],
  raw: string
): T | null {
  const code = normalizeCode(raw);
  if (!code) return null;

  const exact = products.find(
    (p) => eq(p.barcode, code) || eq(p.sku, code) || eq(p.slug, code)
  );
  if (exact) return exact;

  const loose = products.filter(
    (p) => contains(p.barcode, code) || contains(p.sku, code) || contains(p.name_he, code)
  );
  return loose.length === 1 ? loose[0] : null;
}

/** Barcode symbologies we ask the native detector to look for. */
export const SCAN_FORMATS = [
  "qr_code",
  "ean_13",
  "ean_8",
  "code_128",
  "code_39",
  "upc_a",
  "upc_e",
  "itf",
  "codabar",
] as const;
