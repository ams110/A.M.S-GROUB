"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STOCK_REASON_HE } from "@/lib/format";
import type { Product, StockMovement, StockReason } from "@/lib/types";

export default function AdminInventoryPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Movement form.
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [reason, setReason] = useState<StockReason>("purchase");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const productName = useMemo(() => {
    const m = new Map(products.map((p) => [p.id, p]));
    return (id: string) => m.get(id)?.name_he ?? "—";
  }, [products]);

  const load = async () => {
    const [{ data: prods }, { data: moves }] = await Promise.all([
      supabase.from("products").select("*").is("deleted_at", null).order("name_he"),
      supabase
        .from("stock_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setProducts((prods as Product[]) ?? []);
    setMovements((moves as StockMovement[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lowStock = products.filter(
    (p) => p.reorder_point > 0 && p.stock <= p.reorder_point
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!productId) return setError("נא לבחור מוצר.");
    if (qty <= 0) return setError("הכמות חייבת להיות חיובית.");

    setSaving(true);
    const delta = direction === "in" ? qty : -qty;
    const { error } = await supabase.rpc("apply_stock_movement", {
      p_product_id: productId,
      p_delta: delta,
      p_reason: reason,
      p_note: note || null,
    });
    setSaving(false);
    if (error) {
      setError(`שמירה נכשלה: ${error.message}`);
      return;
    }
    setQty(1);
    setNote("");
    load();
  };

  if (loading) return <p className="text-slate-500">טוען…</p>;

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-bold">מלאי ומחסן</h2>

      {/* Low stock */}
      <section>
        <h3 className="mb-3 font-bold">
          התראות מלאי נמוך{" "}
          {lowStock.length > 0 && (
            <span className="badge bg-rose-50 text-rose-700">{lowStock.length}</span>
          )}
        </h3>
        {lowStock.length === 0 ? (
          <p className="text-sm text-slate-400">
            אין מוצרים מתחת לנקודת ההזמנה. (קבעו “נקודת הזמנה” בעריכת מוצר.)
          </p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="p-3">מוצר</th>
                  <th className="p-3">מלאי נוכחי</th>
                  <th className="p-3">נקודת הזמנה</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="p-3 font-medium">{p.name_he}</td>
                    <td className="p-3 font-bold text-rose-600">{p.stock}</td>
                    <td className="p-3">{p.reorder_point}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* New movement */}
      <section>
        <h3 className="mb-3 font-bold">רישום תנועת מלאי</h3>
        <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="label">מוצר</label>
            <select
              className="input"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">— בחרו מוצר —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_he} (מלאי: {p.stock})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">פעולה</label>
            <select
              className="input"
              value={direction}
              onChange={(e) => setDirection(e.target.value as "in" | "out")}
            >
              <option value="in">כניסה (+)</option>
              <option value="out">יציאה (−)</option>
            </select>
          </div>
          <div>
            <label className="label">סיבה</label>
            <select
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value as StockReason)}
            >
              {(["purchase", "adjustment", "return", "initial"] as StockReason[]).map(
                (r) => (
                  <option key={r} value={r}>
                    {STOCK_REASON_HE[r]}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="label">כמות</label>
            <input
              type="number"
              min={1}
              className="input"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="label">הערה</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button disabled={saving} className="btn-primary w-full">
              {saving ? "שומר…" : "רישום"}
            </button>
          </div>
          {error && (
            <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2 lg:col-span-5">
              {error}
            </p>
          )}
        </form>
      </section>

      {/* Ledger */}
      <section>
        <h3 className="mb-3 font-bold">תנועות אחרונות</h3>
        <div className="card overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="p-3">תאריך</th>
                <th className="p-3">מוצר</th>
                <th className="p-3">סיבה</th>
                <th className="p-3">שינוי</th>
                <th className="p-3">יתרה</th>
                <th className="p-3">הערה</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="p-3 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString("he-IL")}
                  </td>
                  <td className="p-3">{productName(m.product_id)}</td>
                  <td className="p-3">{STOCK_REASON_HE[m.reason]}</td>
                  <td
                    className={`p-3 font-bold ${
                      m.delta >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {m.delta >= 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className="p-3">{m.balance_after ?? "—"}</td>
                  <td className="p-3 text-slate-500">
                    {[m.note, m.reference].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    אין תנועות עדיין.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
