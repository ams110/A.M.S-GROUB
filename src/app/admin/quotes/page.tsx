"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, QUOTE_STATUS_HE } from "@/lib/format";
import { computeMargin } from "@/lib/margin";
import type { Product, Profile, Quote, QuoteItem } from "@/lib/types";

type Line = { product_id: string; qty: number; unit_price: number };

export default function AdminQuotesPage() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // New quote.
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", qty: 1, unit_price: 0 }]);
  const [saving, setSaving] = useState(false);

  const customerName = useMemo(() => {
    const m = new Map(customers.map((c) => [c.id, c]));
    return (id: string | null) =>
      id ? m.get(id)?.full_name ?? m.get(id)?.company ?? "—" : "—";
  }, [customers]);

  const itemsByQuote = useMemo(() => {
    const map = new Map<string, QuoteItem[]>();
    items.forEach((it) => {
      const arr = map.get(it.quote_id) ?? [];
      arr.push(it);
      map.set(it.quote_id, arr);
    });
    return map;
  }, [items]);

  const load = async () => {
    const [{ data: profs }, { data: prods }, { data: qs }, { data: qis }] =
      await Promise.all([
        supabase.from("profiles").select("*").neq("role", "admin").order("full_name"),
        supabase.from("products").select("*").is("deleted_at", null).order("name_he"),
        supabase.from("quotes").select("*").order("created_at", { ascending: false }),
        supabase.from("quote_items").select("*"),
      ]);
    setCustomers((profs as Profile[]) ?? []);
    setProducts((prods as Product[]) ?? []);
    setQuotes((qs as Quote[]) ?? []);
    setItems((qis as QuoteItem[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quoteTotal = (qid: string) =>
    (itemsByQuote.get(qid) ?? []).reduce((s, it) => s + Number(it.line_total), 0);

  // Suggested price for a product given the selected customer's type.
  const suggestPrice = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return 0;
    const cust = customers.find((c) => c.id === customerId);
    if (cust?.customer_type === "contractor") return p.price_contractor || p.price;
    return p.price;
  };

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((l) => l.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const onPickProduct = (i: number, productId: string) =>
    setLine(i, { product_id: productId, unit_price: suggestPrice(productId) });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerId) return setError("נא לבחור לקוח.");
    const valid = lines.filter((l) => l.product_id && l.qty > 0);
    if (valid.length === 0) return setError("נא להוסיף לפחות שורה אחת.");

    setSaving(true);
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .insert({
        customer_id: customerId,
        valid_until: validUntil || null,
        notes: notes || null,
        status: "draft",
      })
      .select()
      .single();
    if (qErr || !quote) {
      setSaving(false);
      return setError(`שמירה נכשלה: ${qErr?.message}`);
    }

    const rows = valid.map((l) => {
      const p = products.find((x) => x.id === l.product_id)!;
      return {
        quote_id: (quote as Quote).id,
        product_id: l.product_id,
        name_he: p.name_he,
        sku: p.sku,
        unit_price: l.unit_price,
        qty: l.qty,
        line_total: l.unit_price * l.qty,
      };
    });
    const { error: iErr } = await supabase.from("quote_items").insert(rows);
    setSaving(false);
    if (iErr) return setError(`שמירת שורות נכשלה: ${iErr.message}`);

    setShowForm(false);
    setCustomerId("");
    setValidUntil("");
    setNotes("");
    setLines([{ product_id: "", qty: 1, unit_price: 0 }]);
    load();
  };

  const setStatus = async (q: Quote, status: Quote["status"]) => {
    setQuotes((r) => r.map((x) => (x.id === q.id ? { ...x, status } : x)));
    await supabase.from("quotes").update({ status }).eq("id", q.id);
  };

  const convert = async (q: Quote) => {
    if (!confirm("להמיר את ההצעה להזמנה? המלאי יעודכן בהתאם.")) return;
    setBusyId(q.id);
    const { error } = await supabase.rpc("convert_quote_to_order", { p_quote_id: q.id });
    setBusyId(null);
    if (error) {
      setError(`המרה נכשלה: ${error.message}`);
      return;
    }
    load();
  };

  if (loading) return <p className="text-slate-500">טוען…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">הצעות מחיר</h2>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          {showForm ? "ביטול" : "+ הצעת מחיר חדשה"}
        </button>
      </div>

      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {showForm && (
        <form onSubmit={save} className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">לקוח</label>
              <select
                className="input"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">— בחרו לקוח —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.full_name || c.company || "—") +
                      (c.customer_type === "contractor" ? " (קבלן)" : " (סוחר)")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">בתוקף עד</label>
              <input
                type="date"
                className="input"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            <div>
              <label className="label">הערות</label>
              <input
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">שורות</span>
              <button
                type="button"
                onClick={() => setLines((l) => [...l, { product_id: "", qty: 1, unit_price: 0 }])}
                className="text-sm text-brand hover:underline"
              >
                + שורה
              </button>
            </div>
            {lines.map((l, i) => {
              const prod = products.find((x) => x.id === l.product_id);
              const m = prod ? computeMargin(l.unit_price, prod.cost) : null;
              return (
              <div key={i}>
                <div className="grid grid-cols-[1fr_90px_120px_auto] gap-2">
                  <select
                    className="input"
                    value={l.product_id}
                    onChange={(e) => onPickProduct(i, e.target.value)}
                  >
                    <option value="">— מוצר —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name_he}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    placeholder="כמות"
                    value={l.qty}
                    onChange={(e) => setLine(i, { qty: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className={`input ${m?.belowCost ? "border-rose-400" : ""}`}
                    placeholder="מחיר יח׳"
                    value={l.unit_price}
                    onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })}
                  />
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    className="px-2 text-slate-400 hover:text-rose-600"
                  >
                    ✕
                  </button>
                </div>
                {m && m.known && (
                  <p className="mt-0.5 pr-1 text-xs">
                    {m.belowCost ? (
                      <span className="font-bold text-rose-600">מתחת לעלות ({formatPrice(prod!.cost)}) ⚠</span>
                    ) : (
                      <span className={m.thin ? "text-amber-600" : "text-slate-400"}>
                        מרווח {m.marginPct.toFixed(0)}%{m.thin && " — נמוך ⚠"}
                      </span>
                    )}
                  </p>
                )}
              </div>
              );
            })}
          </div>

          <button disabled={saving} className="btn-primary">
            {saving ? "שומר…" : "יצירת הצעת מחיר"}
          </button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-3">מס׳</th>
              <th className="p-3">לקוח</th>
              <th className="p-3">תאריך</th>
              <th className="p-3">בתוקף עד</th>
              <th className="p-3">סכום</th>
              <th className="p-3">סטטוס</th>
              <th className="p-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} className="border-b border-slate-100">
                <td className="p-3 font-mono">{q.quote_number}</td>
                <td className="p-3">{customerName(q.customer_id)}</td>
                <td className="p-3 whitespace-nowrap">
                  {new Date(q.created_at).toLocaleDateString("he-IL")}
                </td>
                <td className="p-3 whitespace-nowrap">
                  {q.valid_until
                    ? new Date(q.valid_until).toLocaleDateString("he-IL")
                    : "—"}
                </td>
                <td className="p-3 font-medium">{formatPrice(quoteTotal(q.id))}</td>
                <td className="p-3">
                  <span
                    className={`badge ${
                      q.status === "converted"
                        ? "bg-emerald-50 text-emerald-700"
                        : q.status === "rejected" || q.status === "expired"
                        ? "bg-slate-100 text-slate-500"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {QUOTE_STATUS_HE[q.status]}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-3">
                    <Link href={`/quote?id=${q.id}`} className="text-brand hover:underline">
                      צפייה
                    </Link>
                    {q.status === "draft" && (
                      <button
                        onClick={() => setStatus(q, "sent")}
                        className="text-slate-600 hover:underline"
                      >
                        סימון כנשלחה
                      </button>
                    )}
                    {q.status !== "converted" && (
                      <button
                        onClick={() => convert(q)}
                        disabled={busyId === q.id}
                        className="text-emerald-700 hover:underline"
                      >
                        {busyId === q.id ? "ממיר…" : "המרה להזמנה"}
                      </button>
                    )}
                    {q.order_id && (
                      <Link
                        href={`/account/order?id=${q.order_id}`}
                        className="text-brand hover:underline"
                      >
                        להזמנה
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  אין הצעות מחיר עדיין.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
