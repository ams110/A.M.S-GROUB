/**
 * Re-order helper — turn a past order's items into addable cart lines.
 *
 * Shared by the order-detail page and the orders list so "order again" behaves
 * identically everywhere: it pulls the *current* catalogue rows for the order's
 * products, applies the dealer's effective pricing, and keeps only items that
 * are still orderable and in stock (qty capped at stock, floored at min order).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyEffectivePrices } from "./pricing";
import type { Product } from "./types";

export type ReorderItemInput = { product_id: string | null; qty: number };

export type AddableLine = {
  line: {
    product_id: string;
    slug: string;
    name_he: string;
    price: number;
    image_url: string | null;
    min_order_qty: number;
    stock: number;
  };
  qty: number;
};

export async function resolveReorder(
  supabase: SupabaseClient,
  items: ReorderItemInput[]
): Promise<{ addable: AddableLine[]; skipped: number }> {
  const ids = items.map((i) => i.product_id).filter(Boolean) as string[];
  if (ids.length === 0) return { addable: [], skipped: items.length };

  const { data } = await supabase
    .from("products")
    .select("*")
    .in("id", ids)
    .is("deleted_at", null);
  const products = await applyEffectivePrices(supabase, (data as Product[]) ?? []);
  const byId = new Map(products.map((p) => [p.id, p]));

  const addable: AddableLine[] = [];
  let skipped = 0;
  for (const it of items) {
    const p = it.product_id ? byId.get(it.product_id) : undefined;
    if (!p || !p.is_orderable || p.stock <= 0) {
      skipped += 1;
      continue;
    }
    const qty = Math.max(p.min_order_qty || 1, Math.min(it.qty, p.stock));
    addable.push({
      line: {
        product_id: p.id,
        slug: p.slug,
        name_he: p.name_he,
        price: p.price,
        image_url: p.image_url,
        min_order_qty: p.min_order_qty,
        stock: p.stock,
      },
      qty,
    });
  }
  return { addable, skipped };
}
