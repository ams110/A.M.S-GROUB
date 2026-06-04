"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { formatPrice, QUOTE_STATUS_HE } from "@/lib/format";
import type { Profile, Quote, QuoteItem } from "@/lib/types";

const ACCEPT_ERROR_HE: Record<string, string> = {
  ALREADY_CONVERTED: "ההצעה כבר הומרה להזמנה.",
  QUOTE_NOT_OPEN: "לא ניתן לאשר הצעה זו.",
  QUOTE_EXPIRED: "תוקף ההצעה פג.",
  DEALER_NOT_APPROVED: "החשבון ממתין לאישור היבואן.",
  NOT_AUTHORIZED: "אין הרשאה לאשר הצעה זו.",
};

function QuoteView() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const toast = useToast();
  const { userId } = useProfile();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(id !== "");
  const [accepting, setAccepting] = useState(false);

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

  // The signed-in dealer may accept their own open quote and turn it into an
  // order — no need to wait for the importer.
  const isExpired =
    !!quote.valid_until && new Date(quote.valid_until) < new Date(new Date().toDateString());
  const canAccept =
    !!userId &&
    quote.customer_id === userId &&
    !quote.order_id &&
    !["converted", "rejected", "expired"].includes(quote.status) &&
    !isExpired;

  const accept = async () => {
    if (!confirm("לאשר את ההצעה ולהפוך אותה להזמנה? המלאי יישמר עבורך.")) return;
    setAccepting(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("accept_my_quote", { p_quote_id: quote.id });
    setAccepting(false);
    if (error) {
      const code = error.message.split(":")[0].trim();
      if (/INSUFFICIENT_STOCK/.test(error.message)) {
        toast("אחד הפריטים אזל מהמלאי. פנו אלינו ונשמח לעזור.", "error");
      } else {
        toast(ACCEPT_ERROR_HE[code] ?? `האישור נכשל: ${error.message}`, "error");
      }
      return;
    }
    toast("ההצעה אושרה והפכה להזמנה 🎉");
    router.push(`/account/order?id=${data.id}&new=1`);
  };

  return (
    <div className="container-app py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/account/quotes" className="text-sm text-brand hover:underline">
          ← להצעות המחיר שלי
        </Link>
        <div className="flex items-center gap-3">
          {canAccept && (
            <button onClick={accept} disabled={accepting} className="btn-gold disabled:opacity-50">
              {accepting ? "מאשר…" : "✓ אישור והזמנה"}
            </button>
          )}
          <button onClick={() => window.print()} className="btn-primary">
            הדפסה / שמירה כ-PDF
          </button>
        </div>
      </div>

      {canAccept && (
        <div className="mb-4 rounded-xl border border-gold/30 bg-gold-50 px-4 py-3 text-sm text-navy-dark print:hidden">
          הצעה זו בתוקף — ניתן לאשר אותה כעת והיא תהפוך אוטומטית להזמנה.
        </div>
      )}

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
