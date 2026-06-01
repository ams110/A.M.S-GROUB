"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/lib/types";

/**
 * Replace each product's `price` with the effective price for the signed-in
 * user (per-customer override > contractor price > base/dealer price),
 * computed server-side by the `my_prices` RPC. Visitors keep the base price
 * (prices are hidden from them anyway).
 *
 * Because the override happens here, everything downstream (ProductCard, cart,
 * checkout) uses the right price, and `place_order` re-derives it server-side.
 */
export async function applyEffectivePrices<T extends Product>(
  supabase: SupabaseClient,
  products: T[]
): Promise<T[]> {
  if (products.length === 0) return products;
  const { data } = await supabase.rpc("my_prices");
  if (!data) return products;
  const map = new Map<string, number>(
    (data as { product_id: string; price: number }[]).map((r) => [
      r.product_id,
      Number(r.price),
    ])
  );
  return products.map((p) => (map.has(p.id) ? { ...p, price: map.get(p.id)! } : p));
}
