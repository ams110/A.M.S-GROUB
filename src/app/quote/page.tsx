"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, QUOTE_STATUS_HE } from "@/lib/format";
import type { Profile, Quote, QuoteItem } from "@/lib/types";

function QuoteView() {
  const id = useSearchParams().get("id") ?? "";

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(id !== "");

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const { data: q } = await supabase.from("quotes").select("*").eq("id", id).single();
      if (!q) {
        setQuote(null);
        setLoading(false);
        return;
      }
      setQuote(q as Quote);

      const [{ data: its }, { data: settings }, cust] = await Promise.all([
        supabase.from("quote_items").select("*").eq("quote_id", id),
        supabase.from("settings").select("key,value"),
        (q as Quote).customer_id
          ? supabase.from("profiles").select("*").eq("id", (q as Quote).customer_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setItems((its as QuoteItem[]) ?? []);
      setBusiness(Object.fromEntries((settings ?? []).map((r) => [r.key, r.value ?? ""])));
      setCustomer((cust.data as Profile) ?? null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="container-app py-16 text-center text-slate-500">טוען…</div>;
  if (!quote) {
    return (
      <div className="container-app py-20 text-center">
        <h1 className="text-2xl font-bold">הצעת המחיר לא נמצאה</h1>
      </div>
    );
  }

  const total = items.reduce((s, l) => s + Number(l.line_total), 0);

  return (
    <div className="container-app py-10">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/account/quotes" className="text-sm text-brand hover:underline">
          ← להצעות המחיר שלי
        </Link>
        <button onClick={() => window.print()} className="btn-primary">
          הדפסה / שמירה כ-PDF
        </button>
      </div>

      <div className="card mx-auto max-w-3xl p-8">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold">הצעת מחיר</h1>
            <p className="mt-1 text-sm text-slate-500">
              מס׳ {quote.quote_number} ·{" "}
              {new Date(quote.created_at).toLocaleDateString("he-IL")}
            </p>
            <p className="mt-1 text-sm">
              סטטוס:{" "}
              <span className="font-medium">{QUOTE_STATUS_HE[quote.status]}</span>
            </p>
            {quote.valid_until && (
              <p className="text-sm text-slate-500">
                בתוקף עד: {new Date(quote.valid_until).toLocaleDateString("he-IL")}
              </p>
            )}
          </div>
          <div className="text-left text-sm">
            <p className="text-lg font-bold">{business.business_name || "—"}</p>
            {business.business_tax_id && <p>ע.מ/ח.פ: {business.business_tax_id}</p>}
            {business.business_address && <p>{business.business_address}</p>}
            {business.business_phone && <p>טל: {business.business_phone}</p>}
            {business.business_email && <p>{business.business_email}</p>}
          </div>
        </div>

        <div className="py-4 text-sm">
          <h2 className="mb-1 font-bold">לכבוד</h2>
          <p>{customer?.full_name ?? customer?.company ?? "—"}</p>
          {customer?.company && customer.full_name && <p>{customer.company}</p>}
          {customer?.phone && <p>טל: {customer.phone}</p>}
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
                <td className="p-2">{formatPrice(l.unit_price)}</td>
                <td className="p-2">{l.qty}</td>
                <td className="p-2">{formatPrice(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto max-w-xs">
          <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold">
            <span>סה״כ</span>
            <span className="text-brand-dark">{formatPrice(total)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">המחירים אינם כוללים מע״מ.</p>
        </div>

        {quote.notes && (
          <p className="mt-6 whitespace-pre-line border-t border-slate-200 pt-4 text-sm text-slate-600">
            {quote.notes}
          </p>
        )}
      </div>
    </div>
  );
}

export default function QuotePage() {
  return (
    <Suspense fallback={<div className="container-app py-16 text-center text-slate-500">טוען…</div>}>
      <QuoteView />
    </Suspense>
  );
}
