"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/CartProvider";
import { useToast } from "@/components/Toast";
import { applyEffectivePrices } from "@/lib/pricing";
import {
  formatPrice,
  ORDER_STATUS_HE,
  PAYMENT_METHOD_HE,
  PAYMENT_STATUS_HE,
} from "@/lib/format";
import type { Order, OrderItem, Product } from "@/lib/types";

function OrderDetail() {
  const params = useSearchParams();
  const router = useRouter();
  const cart = useCart();
  const toast = useToast();
  const id = params.get("id") ?? "";
  const isNew = params.get("new") === "1";

  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderItem[]>([]);
  const [bank, setBank] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);

  // "Order the same again": pull the current catalogue rows for this order's
  // products, apply the dealer's pricing, add whatever is still orderable to
  // the cart (capped at stock / min qty) and go to the cart.
  const reorder = async () => {
    if (!lines.length) return;
    setReordering(true);
    try {
      const supabase = createClient();
      const ids = lines.map((l) => l.product_id).filter(Boolean) as string[];
      const { data } = await supabase
        .from("products")
        .select("*")
        .in("id", ids)
        .is("deleted_at", null);
      const products = await applyEffectivePrices(supabase, (data as Product[]) ?? []);
      const byId = new Map(products.map((p) => [p.id, p]));

      let added = 0;
      let skipped = 0;
      for (const l of lines) {
        const p = l.product_id ? byId.get(l.product_id) : undefined;
        if (!p || !p.is_orderable || p.stock <= 0) {
          skipped += 1;
          continue;
        }
        const qty = Math.max(p.min_order_qty || 1, Math.min(l.qty, p.stock));
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
          qty
        );
        added += 1;
      }

      if (added === 0) {
        toast("אף אחד מהמוצרים אינו זמין כעת להזמנה", "info");
        setReordering(false);
        return;
      }
      toast(skipped > 0 ? `נוספו ${added} פריטים · ${skipped} אינם זמינים` : `נוספו ${added} פריטים לעגלה`);
      router.push("/cart");
    } catch {
      toast("ההזמנה החוזרת נכשלה", "error");
      setReordering(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const { data: o } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

      if (!o) {
        setOrder(null);
        setLoading(false);
        return;
      }
      setOrder(o as Order);

      const [{ data: items }, { data: settings }] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", id),
        supabase.from("settings").select("key,value").in("key", ["bank_details"]),
      ]);
      setLines((items as OrderItem[]) ?? []);
      setBank(settings?.find((s) => s.key === "bank_details")?.value);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="container-app py-16 text-center text-slate-500">טוען…</div>;
  }

  if (!order) {
    return (
      <div className="container-app py-20 text-center">
        <h1 className="text-2xl font-bold">ההזמנה לא נמצאה</h1>
        <Link href="/account/orders" className="btn-primary mt-6 inline-flex">
          לכל ההזמנות
        </Link>
      </div>
    );
  }

  const o = order;

  return (
    <div className="container-app max-w-3xl py-10">
      <Link href="/account/orders" className="text-sm text-brand hover:underline">
        ← לכל ההזמנות
      </Link>

      {isNew && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          <strong>ההזמנה התקבלה!</strong> מספר הזמנה: {o.order_number}. נטפל בה בהקדם.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">הזמנה {o.order_number}</h1>
        <div className="flex items-center gap-3">
          {lines.length > 0 && (
            <button
              onClick={reorder}
              disabled={reordering}
              className="btn-gold py-1.5 text-sm disabled:opacity-50"
            >
              {reordering ? "מוסיף…" : "🔁 הזמן שוב"}
            </button>
          )}
          <Link href={`/invoice?order=${o.id}`} className="text-sm text-brand hover:underline">
            חשבונית מס
          </Link>
          <span className="badge bg-brand-light text-brand-dark">
            {ORDER_STATUS_HE[o.status]}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {new Date(o.created_at).toLocaleString("he-IL")}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-4 text-sm">
          <h2 className="mb-2 font-bold">פרטי משלוח</h2>
          <p>{o.ship_name}</p>
          <p>{o.ship_phone}</p>
          <p>
            {o.ship_address}
            {o.ship_city ? `, ${o.ship_city}` : ""}
          </p>
          {o.po_number && (
            <p className="mt-2 text-slate-500">מס׳ הזמנת רכש: {o.po_number}</p>
          )}
          {o.notes && <p className="mt-2 text-slate-500">הערה: {o.notes}</p>}
        </div>
        <div className="card p-4 text-sm">
          <h2 className="mb-2 font-bold">תשלום</h2>
          <p>אמצעי: {PAYMENT_METHOD_HE[o.payment_method]}</p>
          <p>סטטוס תשלום: {PAYMENT_STATUS_HE[o.payment_status]}</p>
          {o.payment_method === "bank_transfer" && o.payment_status === "unpaid" && (
            <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">
              {bank ?? "להעברה בנקאית — פרטי החשבון יישלחו אליכם בנפרד."}
            </p>
          )}
        </div>
      </div>

      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-3">מוצר</th>
              <th className="p-3">מחיר יח׳</th>
              <th className="p-3">כמות</th>
              <th className="p-3">סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="p-3">
                  {l.name_he}
                  {l.sku && <span className="text-slate-400"> · {l.sku}</span>}
                </td>
                <td className="p-3">{formatPrice(l.unit_price, o.currency)}</td>
                <td className="p-3">{l.qty}</td>
                <td className="p-3 font-medium">{formatPrice(l.line_total, o.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-lg font-bold">
              <td className="p-3" colSpan={3}>
                סה״כ
              </td>
              <td className="p-3 text-brand-dark">{formatPrice(o.total, o.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<div className="container-app py-16 text-center text-slate-500">טוען…</div>}>
      <OrderDetail />
    </Suspense>
  );
}
