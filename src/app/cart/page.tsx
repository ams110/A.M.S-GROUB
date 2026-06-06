"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/CartProvider";
import { formatPrice } from "@/lib/format";
import { productImage } from "@/lib/config";
import { computeReceivables, termDays, type AROrder } from "@/lib/ar";
import type { Profile } from "@/lib/types";

export default function CartPage() {
  const { lines, subtotal, setQty, remove, count } = useCart();

  const [creditLimit, setCreditLimit] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [minOrder, setMinOrder] = useState(0);

  // Pull the dealer's credit headroom and the store's minimum-order rule so the
  // cart can warn *before* the checkout step.
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const [{ data: settings }, profRes, ordersRes] = await Promise.all([
        supabase.from("settings").select("key,value").in("key", ["min_order_value"]),
        user ? supabase.from("profiles").select("*").eq("id", user.id).single() : Promise.resolve({ data: null }),
        user
          ? supabase.from("orders").select("total,payment_status,status,created_at")
          : Promise.resolve({ data: [] }),
      ]);
      const min = Number(settings?.find((s) => s.key === "min_order_value")?.value || 0);
      setMinOrder(Number.isFinite(min) ? min : 0);

      const p = profRes.data as Profile | null;
      if (p) {
        setCreditLimit(p.credit_limit || 0);
        const r = computeReceivables((ordersRes.data as AROrder[]) ?? [], termDays(p.payment_terms));
        setOutstanding(r.outstanding);
      }
    })();
  }, []);

  if (count === 0) {
    return (
      <div className="container-app py-16 text-center">
        <p className="text-2xl">🛒</p>
        <h1 className="mt-3 text-xl font-bold">העגלה ריקה</h1>
        <Link href="/products" className="btn-primary mt-6 inline-flex">
          למעבר לקטלוג
        </Link>
      </div>
    );
  }

  const belowMin = minOrder > 0 && subtotal < minOrder;
  const overCredit = creditLimit > 0 && outstanding + subtotal > creditLimit;

  return (
    <div className="container-app py-10">
      <p className="eyebrow mb-1.5">סל ההזמנה שלך</p>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-navy-dark">עגלת קניות</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {lines.map((l) => (
            <div key={l.product_id} className="card flex items-center gap-4 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productImage(l.image_url)}
                alt={l.name_he}
                className="h-20 w-20 rounded-lg object-cover"
              />
              <div className="flex-1">
                <Link href={`/product?slug=${l.slug}`} className="text-sm font-semibold hover:text-brand">
                  {l.name_he}
                </Link>
                <p className="text-sm text-slate-500">{formatPrice(l.price)} ליחידה</p>
              </div>
              <input
                type="number"
                min={l.min_order_qty || 1}
                max={l.stock}
                value={l.qty}
                onChange={(e) => setQty(l.product_id, Number(e.target.value))}
                className="input w-20"
              />
              <div className="w-24 text-left font-bold text-brand-dark">
                {formatPrice(l.price * l.qty)}
              </div>
              <button
                onClick={() => remove(l.product_id)}
                className="text-slate-400 hover:text-rose-600"
                aria-label="הסרה"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <aside className="card h-fit space-y-4 p-5">
          <h2 className="text-lg font-bold">סיכום הזמנה</h2>
          <div className="flex justify-between text-sm">
            <span>מוצרים</span>
            <span>{count}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-3 text-lg font-bold">
            <span>סה״כ</span>
            <span className="text-brand-dark">{formatPrice(subtotal)}</span>
          </div>
          <p className="text-xs text-slate-400">המחיר ללא מע״מ ולא כולל משלוח.</p>

          {belowMin && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              סכום הזמנה מינימלי הוא {formatPrice(minOrder)}. חסרים{" "}
              <strong>{formatPrice(minOrder - subtotal)}</strong> כדי להמשיך.
            </div>
          )}

          {overCredit && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              ⚠ ההזמנה חורגת ממסגרת האשראי ({formatPrice(creditLimit)}). חוב נוכחי:{" "}
              {formatPrice(outstanding)}. ייתכן שתידרש אישור היבואן.
            </div>
          )}

          {belowMin ? (
            <button disabled className="btn-primary w-full cursor-not-allowed opacity-50">
              מעבר לתשלום
            </button>
          ) : (
            <Link href="/checkout" className="btn-primary w-full">
              מעבר לתשלום
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
