"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { applyEffectivePrices } from "@/lib/pricing";
import { useCart } from "@/components/CartProvider";
import { useToast } from "@/components/Toast";
import { formatPrice } from "@/lib/format";
import { buildReorderSuggestions, isDue, type ReorderSuggestion } from "@/lib/reorder";
import type { Order, OrderItem, Product } from "@/lib/types";

// A suggestion joined with the product's *current* catalogue state.
type Row = ReorderSuggestion & {
  product: Product | null;
  qty: number;
  selected: boolean;
};

export default function ReorderPage() {
  const router = useRouter();
  const { ready, userId } = useProfile();
  const cart = useCart();
  const toast = useToast();

  const [rows, setRows] = useState<Row[]>([]);
  const [currency, setCurrency] = useState("ILS");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !userId) router.replace("/login?redirect=/account/reorder");
  }, [ready, userId, router]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    (async () => {
      setLoading(true);

      // RLS scopes orders/items to the signed-in dealer.
      const { data: orders } = await supabase
        .from("orders")
        .select("id,created_at,currency")
        .order("created_at", { ascending: false });
      const orderList = (orders as Pick<Order, "id" | "created_at" | "currency">[]) ?? [];
      if (orderList.length) setCurrency(orderList[0].currency ?? "ILS");

      if (orderList.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const ids = orderList.map((o) => o.id);
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id,product_id,name_he,sku,qty,unit_price")
        .in("order_id", ids);
      const itemList = (items as OrderItem[]) ?? [];

      const suggestions = buildReorderSuggestions(orderList, itemList);

      // Pull the live catalogue row for each suggested product (price, stock,
      // availability) and apply this dealer's effective pricing.
      const productIds = suggestions.map((s) => s.product_id);
      let products: Product[] = [];
      if (productIds.length) {
        const { data: prods } = await supabase
          .from("products")
          .select("*")
          .in("id", productIds)
          .is("deleted_at", null);
        products = await applyEffectivePrices(supabase, (prods as Product[]) ?? []);
      }
      const productMap = new Map(products.map((p) => [p.id, p]));

      const built: Row[] = suggestions
        .map((s) => {
          const product = productMap.get(s.product_id) ?? null;
          const maxQty = product?.stock ?? s.typicalQty;
          const minQty = product?.min_order_qty || 1;
          const qty = Math.max(minQty, Math.min(s.typicalQty, maxQty || s.typicalQty));
          return { ...s, product, qty, selected: isDue(s) };
        })
        // Only things we can actually reorder now.
        .filter((r) => r.product && r.product.is_orderable && r.product.stock > 0);

      // If nothing is "due", pre-select the top few so the primary CTA is useful.
      if (built.length && !built.some((r) => r.selected)) {
        built.slice(0, 3).forEach((r) => (r.selected = true));
      }

      setRows(built);
      setLoading(false);
    })();
  }, [userId]);

  const selectedRows = rows.filter((r) => r.selected);
  const selectedTotal = useMemo(
    () => selectedRows.reduce((s, r) => s + r.qty * (r.product?.price ?? r.lastUnitPrice), 0),
    [selectedRows]
  );

  const toggle = (id: string) =>
    setRows((rs) => rs.map((r) => (r.product_id === id ? { ...r, selected: !r.selected } : r)));
  const setQty = (id: string, qty: number) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.product_id !== id) return r;
        const minQty = r.product?.min_order_qty || 1;
        const maxQty = r.product?.stock || qty;
        return { ...r, qty: Math.max(minQty, Math.min(qty, maxQty)) };
      })
    );

  const addSelected = () => {
    const chosen = rows.filter((r) => r.selected && r.product);
    if (chosen.length === 0) {
      toast("לא נבחרו פריטים", "info");
      return;
    }
    for (const r of chosen) {
      const p = r.product!;
      cart.add(
        {
          product_id: p.id,
          slug: p.slug,
          name_he: p.name_he,
          price: p.price,
          image_url: p.image_url,
          min_order_qty: p.min_order_qty,
          stock: p.stock,
        },
        r.qty
      );
    }
    toast(`נוספו ${chosen.length} פריטים לעגלה`);
    router.push("/cart");
  };

  return (
    <div className="container-app py-8">
      <Link href="/account" className="text-sm text-brand hover:underline">
        ← לאזור האישי
      </Link>
      <p className="eyebrow mb-1.5 mt-3">קנייה חוזרת</p>
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-navy-dark">הזמנה חוזרת חכמה</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        ריכזנו עבורך את המוצרים שאתה מזמין בקביעות, עם הכמות הרגילה שלך. סמן ובחר —
        והכל ייכנס לעגלה בלחיצה אחת.
      </p>

      {loading ? (
        <div className="card p-10 text-center text-slate-500">טוען המלצות…</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          עדיין אין מספיק היסטוריית הזמנות להמלצה.{" "}
          <Link href="/products" className="font-semibold text-brand hover:underline">
            למעבר לקטלוג
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {rows.map((r) => {
              const due = isDue(r);
              const price = r.product?.price ?? r.lastUnitPrice;
              return (
                <div
                  key={r.product_id}
                  className={`flex items-center gap-3 rounded-2xl border bg-white px-3.5 py-3 shadow-sm transition-colors ${
                    r.selected ? "border-gold/50 ring-1 ring-gold/20" : "border-slate-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={() => toggle(r.product_id)}
                    className="h-5 w-5 shrink-0 accent-gold"
                    aria-label={`בחר ${r.name_he}`}
                  />

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.product?.image_url || `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/placeholder.svg`}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-100"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/product?slug=${r.product?.slug ?? ""}`}
                        className="truncate font-semibold text-navy-dark hover:underline"
                      >
                        {r.name_he}
                      </Link>
                      {due && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                          זמן לחדש
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      הוזמן {r.timesOrdered} פעמים · לאחרונה לפני {r.daysSinceLast} ימים
                      {r.avgIntervalDays != null && ` · כל ~${r.avgIntervalDays} ימים`}
                    </p>
                  </div>

                  {/* qty stepper */}
                  <div className="flex shrink-0 items-center rounded-lg border border-slate-200">
                    <button
                      onClick={() => setQty(r.product_id, r.qty - 1)}
                      className="px-2.5 py-1 text-slate-500 hover:text-navy-dark"
                      aria-label="הפחת"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">{r.qty}</span>
                    <button
                      onClick={() => setQty(r.product_id, r.qty + 1)}
                      className="px-2.5 py-1 text-slate-500 hover:text-navy-dark"
                      aria-label="הוסף"
                    >
                      +
                    </button>
                  </div>

                  <div className="w-20 shrink-0 text-left text-sm font-bold text-brand-dark">
                    {formatPrice(r.qty * price, currency)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* sticky action bar */}
          <div className="sticky bottom-20 z-10 mt-5 md:bottom-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-navy-dark px-5 py-4 text-white shadow-navy">
              <div>
                <p className="text-xs text-white/55">{selectedRows.length} פריטים נבחרו</p>
                <p className="text-lg font-extrabold tabular-nums">{formatPrice(selectedTotal, currency)}</p>
              </div>
              <button
                onClick={addSelected}
                disabled={selectedRows.length === 0}
                className="btn-gold disabled:opacity-40"
              >
                הוסף לעגלה ←
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
