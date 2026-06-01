"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import type { Invoice, Order, OrderItem } from "@/lib/types";

function InvoiceView() {
  const supabase = createClient();
  const orderId = useSearchParams().get("order") ?? "";
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    const [{ data: o }, { data: its }, { data: inv }, { data: settings }] =
      await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).single(),
        supabase.from("order_items").select("*").eq("order_id", orderId),
        supabase.from("invoices").select("*").eq("order_id", orderId).maybeSingle(),
        supabase.from("settings").select("key,value"),
      ]);
    setOrder((o as Order) ?? null);
    setItems((its as OrderItem[]) ?? []);
    setInvoice((inv as Invoice) ?? null);
    setBusiness(
      Object.fromEntries((settings ?? []).map((r) => [r.key, r.value ?? ""]))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const issue = async () => {
    setIssuing(true);
    setError(null);
    const { error } = await supabase.rpc("issue_invoice", { p_order_id: orderId });
    setIssuing(false);
    if (error) {
      setError(`הפקת החשבונית נכשלה: ${error.message}`);
      return;
    }
    load();
  };

  if (loading) return <div className="container-app py-16 text-center text-slate-500">טוען…</div>;
  if (!order) {
    return (
      <div className="container-app py-20 text-center">
        <h1 className="text-2xl font-bold">ההזמנה לא נמצאה</h1>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container-app py-16 text-center">
        <h1 className="text-xl font-bold">טרם הופקה חשבונית להזמנה זו</h1>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        {isAdmin ? (
          <button onClick={issue} disabled={issuing} className="btn-primary mt-6 inline-flex">
            {issuing ? "מפיק…" : "הפקת חשבונית מס"}
          </button>
        ) : (
          <p className="mt-3 text-sm text-slate-500">החשבונית תופק על ידי הספק.</p>
        )}
      </div>
    );
  }

  return (
    <div className="container-app py-10">
      {/* Toolbar — hidden when printing */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/account/orders" className="text-sm text-brand hover:underline">
          ← להזמנות שלי
        </Link>
        <button onClick={() => window.print()} className="btn-primary">
          הדפסה / שמירה כ-PDF
        </button>
      </div>

      <div className="card mx-auto max-w-3xl p-8">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold">חשבונית מס</h1>
            <p className="mt-1 text-sm text-slate-500">
              מס׳ {invoice.invoice_number} ·{" "}
              {new Date(invoice.issued_at).toLocaleDateString("he-IL")}
            </p>
          </div>
          <div className="text-left text-sm">
            <p className="text-lg font-bold">{business.business_name || "—"}</p>
            {business.business_tax_id && <p>ע.מ/ח.פ: {business.business_tax_id}</p>}
            {business.business_address && <p>{business.business_address}</p>}
            {business.business_phone && <p>טל: {business.business_phone}</p>}
            {business.business_email && <p>{business.business_email}</p>}
          </div>
        </div>

        <div className="grid gap-4 py-4 text-sm sm:grid-cols-2">
          <div>
            <h2 className="mb-1 font-bold">לכבוד</h2>
            <p>{order.ship_name ?? "—"}</p>
            {order.ship_address && (
              <p>
                {order.ship_address}
                {order.ship_city ? `, ${order.ship_city}` : ""}
              </p>
            )}
            {order.ship_phone && <p>טל: {order.ship_phone}</p>}
          </div>
          <div className="sm:text-left">
            <p>הזמנה: {order.order_number}</p>
            {order.po_number && <p>הזמנת רכש: {order.po_number}</p>}
          </div>
        </div>

        <table className="w-full text-right text-sm">
          <thead className="border-y border-slate-200 text-slate-500">
            <tr>
              <th className="p-2">תיאור</th>
              <th className="p-2">מחיר יח׳</th>
              <th className="p-2">כמות</th>
              <th className="p-2">סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="p-2">
                  {l.name_he}
                  {l.sku && <span className="text-slate-400"> · {l.sku}</span>}
                </td>
                <td className="p-2">{formatPrice(l.unit_price, order.currency)}</td>
                <td className="p-2">{l.qty}</td>
                <td className="p-2">{formatPrice(l.line_total, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span>סה״כ לפני מע״מ</span>
            <span>{formatPrice(invoice.subtotal, order.currency)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>מע״מ {invoice.vat_rate}%</span>
            <span>{formatPrice(invoice.vat, order.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 text-lg font-bold">
            <span>סה״כ לתשלום</span>
            <span className="text-brand-dark">{formatPrice(invoice.total, order.currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="container-app py-16 text-center text-slate-500">טוען…</div>}>
      <InvoiceView />
    </Suspense>
  );
}
