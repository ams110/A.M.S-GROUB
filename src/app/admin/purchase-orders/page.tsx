"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, PO_STATUS_HE } from "@/lib/format";
import type {
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
} from "@/lib/types";

type Line = { product_id: string; qty: number; unit_cost: number };

export default function AdminPurchaseOrdersPage() {
  const supabase = createClient();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // New PO.
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", qty: 1, unit_cost: 0 }]);
  const [saving, setSaving] = useState(false);

  const supplierName = useMemo(() => {
    const m = new Map(suppliers.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [suppliers]);

  const itemsByPo = useMemo(() => {
    const map = new Map<string, PurchaseOrderItem[]>();
    items.forEach((it) => {
      const arr = map.get(it.po_id) ?? [];
      arr.push(it);
      map.set(it.po_id, arr);
    });
    return map;
  }, [items]);

  const load = async () => {
    const [{ data: sup }, { data: prods }, { data: pos }, { data: poItems }] =
      await Promise.all([
        supabase.from("suppliers").select("*").order("name"),
        supabase.from("products").select("*").is("deleted_at", null).order("name_he"),
        supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }),
        supabase.from("purchase_order_items").select("*"),
      ]);
    setSuppliers((sup as Supplier[]) ?? []);
    setProducts((prods as Product[]) ?? []);
    setOrders((pos as PurchaseOrder[]) ?? []);
    setItems((poItems as PurchaseOrderItem[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const poTotal = (poId: string) =>
    (itemsByPo.get(poId) ?? []).reduce((s, it) => s + it.qty * it.unit_cost, 0);

  const setLine = (i: number, p: Partial<Line>) =>
    setLines((l) => l.map((row, j) => (j === i ? { ...row, ...p } : row)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const valid = lines.filter((l) => l.product_id && l.qty > 0);
    if (valid.length === 0) return setError("נא להוסיף לפחות שורה אחת עם מוצר וכמות.");

    setSaving(true);
    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .insert({
        supplier_id: supplierId || null,
        po_number: poNumber || null,
        notes: notes || null,
        status: "ordered",
      })
      .select()
      .single();

    if (poErr || !po) {
      setSaving(false);
      return setError(`שמירה נכשלה: ${poErr?.message}`);
    }

    const { error: itemsErr } = await supabase.from("purchase_order_items").insert(
      valid.map((l) => ({
        po_id: (po as PurchaseOrder).id,
        product_id: l.product_id,
        qty: l.qty,
        unit_cost: l.unit_cost,
      }))
    );
    setSaving(false);
    if (itemsErr) return setError(`שמירת שורות נכשלה: ${itemsErr.message}`);

    setShowForm(false);
    setSupplierId("");
    setPoNumber("");
    setNotes("");
    setLines([{ product_id: "", qty: 1, unit_cost: 0 }]);
    load();
  };

  const receive = async (po: PurchaseOrder) => {
    if (!confirm("לקלוט את ההזמנה למלאי? הכמויות יתווספו למלאי המוצרים.")) return;
    setBusyId(po.id);
    const { error } = await supabase.rpc("receive_purchase_order", { p_po_id: po.id });
    setBusyId(null);
    if (error) {
      setError(`קליטה נכשלה: ${error.message}`);
      return;
    }
    load();
  };

  const cancel = async (po: PurchaseOrder) => {
    if (!confirm("לבטל את הזמנת הרכש?")) return;
    setOrders((r) => r.map((x) => (x.id === po.id ? { ...x, status: "cancelled" } : x)));
    await supabase.from("purchase_orders").update({ status: "cancelled" }).eq("id", po.id);
  };

  if (loading) return <p className="text-slate-500">טוען…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">הזמנות רכש</h2>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          {showForm ? "ביטול" : "+ הזמנת רכש חדשה"}
        </button>
      </div>

      {error && (
        <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      {showForm && (
        <form onSubmit={save} className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">ספק</label>
              <select
                className="input"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">— ללא —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">מס׳ הזמנה (ידני)</label>
              <input
                className="input"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
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
                onClick={() => setLines((l) => [...l, { product_id: "", qty: 1, unit_cost: 0 }])}
                className="text-sm text-brand hover:underline"
              >
                + שורה
              </button>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_120px_auto] gap-2">
                <select
                  className="input"
                  value={l.product_id}
                  onChange={(e) => setLine(i, { product_id: e.target.value })}
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
                  className="input"
                  placeholder="עלות ליח׳"
                  value={l.unit_cost}
                  onChange={(e) => setLine(i, { unit_cost: Number(e.target.value) })}
                />
                <button
                  type="button"
                  onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  className="px-2 text-slate-400 hover:text-rose-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button disabled={saving} className="btn-primary">
            {saving ? "שומר…" : "יצירת הזמנת רכש"}
          </button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-3">תאריך</th>
              <th className="p-3">מס׳</th>
              <th className="p-3">ספק</th>
              <th className="p-3">פריטים</th>
              <th className="p-3">סכום</th>
              <th className="p-3">סטטוס</th>
              <th className="p-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((po) => (
              <tr key={po.id} className="border-b border-slate-100">
                <td className="p-3 whitespace-nowrap">
                  {new Date(po.created_at).toLocaleDateString("he-IL")}
                </td>
                <td className="p-3">{po.po_number ?? "—"}</td>
                <td className="p-3">{supplierName(po.supplier_id)}</td>
                <td className="p-3">{(itemsByPo.get(po.id) ?? []).length}</td>
                <td className="p-3 font-medium">{formatPrice(poTotal(po.id))}</td>
                <td className="p-3">
                  <span
                    className={`badge ${
                      po.status === "received"
                        ? "bg-emerald-50 text-emerald-700"
                        : po.status === "cancelled"
                        ? "bg-slate-100 text-slate-500"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {PO_STATUS_HE[po.status]}
                  </span>
                </td>
                <td className="p-3">
                  {po.status !== "received" && po.status !== "cancelled" && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => receive(po)}
                        disabled={busyId === po.id}
                        className="text-emerald-700 hover:underline"
                      >
                        {busyId === po.id ? "קולט…" : "קליטה למלאי"}
                      </button>
                      <button
                        onClick={() => cancel(po)}
                        className="text-rose-700 hover:underline"
                      >
                        ביטול
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  אין הזמנות רכש עדיין.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
