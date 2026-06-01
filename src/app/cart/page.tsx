"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { formatPrice } from "@/lib/format";
import { asset } from "@/lib/config";

export default function CartPage() {
  const { lines, subtotal, setQty, remove, count } = useCart();

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

  return (
    <div className="container-app py-10">
      <h1 className="mb-6 text-2xl font-bold">עגלת קניות</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {lines.map((l) => (
            <div key={l.product_id} className="card flex items-center gap-4 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={l.image_url ?? asset("/placeholder.svg")}
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
          <Link href="/checkout" className="btn-primary w-full">
            מעבר לתשלום
          </Link>
        </aside>
      </div>
    </div>
  );
}
