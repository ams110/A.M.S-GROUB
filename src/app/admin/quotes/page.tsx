"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, QUOTE_STATUS_HE } from "@/lib/format";
import { computeMargin, recommendPrice } from "@/lib/margin";
import { quoteMessage, waMessageLink } from "@/lib/messages";
import { WizardStepper } from "@/components/WizardStepper";
import { ReviewCard, ReviewItem } from "@/components/ReviewSummary";
import { BASE_PATH } from "@/lib/config";
import type { Product, Profile, Quote, QuoteItem } from "@/lib/types";

type Line = { product_id: string; qty: number; unit_price: number };

const QUOTE_STEPS = ["לקוח", "פריטים", "סיכום"];

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
  const [formStep, setFormStep] = useState(0);
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
        // Customers only (dealers + contractors all carry role "dealer").
        // Admins / super-admins are staff, not buyers — keep them out of the
        // quote customer list (".neq admin" let super_admin slip through).
        supabase.from("profiles").select("*").eq("role", "dealer").order("full_name"),
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

  // WhatsApp link to send a quote to its customer, with a link they can open
  // and accept themselves.
  const quoteWaLink = (q: Quote): string | null => {
    const cust = customers.find((c) => c.id === q.customer_id);
    if (!cust?.phone) return null;
    const viewUrl =
      typeof window !== "undefined" ? `${window.location.origin}${BASE_PATH}/quote?id=${q.id}` : "";
    return waMessageLink(
      cust.phone,
      quoteMessage({
        name: cust.full_name || cust.company || undefined,
        quoteNumber: q.quote_number,
        total: quoteTotal(q.id),
        validUntil: q.valid_until,
        viewUrl,
      })
    );
  };

  // The catalogue list price for the selected customer's type.
  const listPriceFor = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return 0;
    const cust = customers.find((c) => c.id === customerId);
    if (cust?.customer_type === "contractor") return p.price_contractor || p.price;
    return p.price;
  };

  // The unit price this customer last saw for a product, from their most recent
  // quote — the anchor we don't want to silently move on them.
  const lastPaidFor = (productId: string): number | null => {
    if (!customerId) return null;
    const quoteTime = new Map(quotes.map((q) => [q.id, new Date(q.created_at).getTime()]));
    let best: { t: number; price: number } | null = null;
    for (const it of items) {
      if (it.product_id !== productId) continue;
      const q = quotes.find((x) => x.id === it.quote_id);
      if (q?.customer_id !== customerId) continue;
      const t = quoteTime.get(it.quote_id) ?? 0;
      if (!best || t > best.t) best = { t, price: Number(it.unit_price) };
    }
    return best?.price ?? null;
  };

  // History-aware recommendation: keep the customer's anchor, never below a
  // healthy margin floor, else fall back to list / cost-plus.
  const recommendFor = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    return recommendPrice({
      cost: p?.cost ?? 0,
      listPrice: listPriceFor(productId),
      lastPaid: lastPaidFor(productId),
    });
  };

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((l) => l.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const onPickProduct = (i: number, productId: string) =>
    setLine(i, { product_id: productId, unit_price: productId ? recommendFor(productId).price : 0 });

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
    setFormStep(0);
    setCustomerId("");
    setValidUntil("");
    setNotes("");
    setLines([{ product_id: "", qty: 1, unit_price: 0 }]);
    load();
  };

  // Form total (valid lines) — shown in the review step.
  const formValidLines = lines.filter((l) => l.product_id && l.qty > 0);
  const formTotal = formValidLines.reduce((s, l) => s + l.unit_price * l.qty, 0);

  const nextQuoteStep = () => {
    setError(null);
    if (formStep === 0 && !customerId) return setError("נא לבחור לקוח.");
    if (formStep === 1 && formValidLines.length === 0)
      return setError("נא להוסיף לפחות שורה אחת.");
    setFormStep((s) => s + 1);
  };

  const onQuoteSubmit = (e: React.FormEvent) => {
    if (formStep < 2) {
      e.preventDefault();
      nextQuoteStep();
    } else {
      save(e);
    }
  };

  const openForm = () => {
    setError(null);
    setFormStep(0);
    setShowForm((v) => !v);
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
        <button onClick={openForm} className={showForm ? "btn-outline" : "btn-gold"}>
          {showForm ? "ביטול" : "+ הצעת מחיר חדשה"}
        </button>
      </div>

      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {showForm && (
        <form onSubmit={onQuoteSubmit} className="card space-y-5 p-5">
          <WizardStepper
            steps={QUOTE_STEPS}
            current={formStep}
            onStepClick={(i) => {
              // Allow jumping back, or forward only once prerequisites are met.
              if (i <= formStep) setFormStep(i);
              else if (i === 1 && customerId) setFormStep(1);
              else if (i === 2 && customerId && formValidLines.length) setFormStep(2);
            }}
          />

          <div key={formStep} className="animate-fade-up space-y-4">
          {/* Step 0 — customer & terms */}
          {formStep === 0 && (
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
          )}

          {/* Step 1 — line items */}
          {formStep === 1 && (
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
              const rec = prod ? recommendFor(l.product_id) : null;
              const recOff = rec && Math.abs(rec.price - l.unit_price) > 0.5;
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
                <div className="mt-0.5 flex flex-wrap items-center gap-2 pr-1 text-xs">
                  {m && m.known && (
                    <span>
                      {m.belowCost ? (
                        <span className="font-bold text-rose-600">מתחת לעלות ({formatPrice(prod!.cost)}) ⚠</span>
                      ) : (
                        <span className={m.thin ? "text-amber-600" : "text-slate-400"}>
                          מרווח {m.marginPct.toFixed(0)}%{m.thin && " — נמוך ⚠"}
                        </span>
                      )}
                    </span>
                  )}
                  {rec && recOff && (
                    <button
                      type="button"
                      onClick={() => setLine(i, { unit_price: rec.price })}
                      title={rec.reason}
                      className="rounded-full bg-gold-50 px-2 py-0.5 font-semibold text-gold-dark ring-1 ring-gold/30 hover:bg-gold-100"
                    >
                      💡 מומלץ {formatPrice(rec.price)}
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
          )}

          {/* Step 2 — review */}
          {formStep === 2 && (
          <ReviewCard title="סיכום ההצעה">
            <ReviewItem label="לקוח" value={customerName(customerId)} />
            <ReviewItem
              label="בתוקף עד"
              value={validUntil ? new Date(validUntil).toLocaleDateString("he-IL") : "—"}
            />
            <ReviewItem label="מספר פריטים" value={String(formValidLines.length)} />
            <ReviewItem label="סה״כ" value={formatPrice(formTotal)} strong />
          </ReviewCard>
          )}
          </div>

          {/* Wizard nav */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => (formStep === 0 ? setShowForm(false) : setFormStep((s) => s - 1))}
              className="btn-outline"
              disabled={saving}
            >
              {formStep === 0 ? "ביטול" : "→ הקודם"}
            </button>
            {formStep < 2 ? (
              <button type="submit" className="btn-gold">
                הבא ←
              </button>
            ) : (
              <button disabled={saving} className="btn-gold">
                {saving ? "שומר…" : "✓ יצירת הצעת מחיר"}
              </button>
            )}
          </div>
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
                    {(() => {
                      const link = quoteWaLink(q);
                      return link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                          וואטסאפ
                        </a>
                      ) : null;
                    })()}
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
