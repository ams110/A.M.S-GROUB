"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, PO_STATUS_HE } from "@/lib/format";
import { computeSalesVelocity, suggestReplenishment } from "@/lib/replenish";
import { purchaseOrderMessage, waMessageLink } from "@/lib/messages";
import { WizardStepper } from "@/components/WizardStepper";
import type {
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
} from "@/lib/types";

type Line = { product_id: string; qty: number; unit_cost: number };

const DAY = 24 * 60 * 60 * 1000;
const PO_STEPS = ["ספק", "פריטים", "סיכום"];

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
  const [formStep, setFormStep] = useState(0);
  const [supplierId, setSupplierId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", qty: 1, unit_cost: 0 }]);
  const [saving, setSaving] = useState(false);

  // Smart replenishment.
  const [velocity, setVelocity] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  // Sales velocity from the last 30 days, to size suggested order quantities.
  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 35 * DAY).toISOString();
      const { data: vOrders } = await supabase
        .from("orders")
        .select("id,created_at")
        .gte("created_at", since);
      const ids = ((vOrders as { id: string }[]) ?? []).map((o) => o.id);
      let vItems: { order_id: string; product_id: string | null; qty: number }[] = [];
      if (ids.length) {
        const { data } = await supabase
          .from("order_items")
          .select("order_id,product_id,qty")
          .in("order_id", ids);
        vItems = (data as typeof vItems) ?? [];
      }
      setVelocity(computeSalesVelocity((vOrders as any[]) ?? [], vItems, { windowDays: 30 }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestions = useMemo(
    () =>
      suggestReplenishment(
        products.map((p) => ({
          id: p.id,
          name_he: p.name_he,
          stock: p.stock,
          reorder_point: p.reorder_point,
          min_order_qty: p.min_order_qty,
          cost: p.cost,
        })),
        velocity
      ),
    [products, velocity]
  );

  // Default every suggestion to picked once they're computed.
  useEffect(() => {
    setPicked((prev) => {
      const next = { ...prev };
      for (const s of suggestions) if (!(s.product_id in next)) next[s.product_id] = true;
      return next;
    });
  }, [suggestions]);

  const pickedSuggestions = suggestions.filter((s) => picked[s.product_id]);
  const suggestTotal = pickedSuggestions.reduce((sum, s) => sum + s.lineCost, 0);

  const fillFromSuggestions = () => {
    if (pickedSuggestions.length === 0) return;
    setLines(
      pickedSuggestions.map((s) => ({
        product_id: s.product_id,
        qty: s.suggestedQty,
        unit_cost: s.unitCost,
      }))
    );
    setShowForm(true);
    setFormStep(1); // jump straight to the (pre-filled) items step
    setError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  // WhatsApp the purchase order to its supplier (item list + quantities).
  const poWaLink = (po: PurchaseOrder): string | null => {
    const sup = suppliers.find((s) => s.id === po.supplier_id);
    if (!sup?.phone) return null;
    const productName = new Map(products.map((p) => [p.id, p.name_he]));
    const lines = (itemsByPo.get(po.id) ?? []).map((it) => ({
      name: productName.get(it.product_id) ?? "—",
      qty: it.qty,
    }));
    if (lines.length === 0) return null;
    return waMessageLink(
      sup.phone,
      purchaseOrderMessage({ supplierName: sup.name, poNumber: po.po_number, lines, notes: po.notes })
    );
  };

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
    setFormStep(0);
    setSupplierId("");
    setPoNumber("");
    setNotes("");
    setLines([{ product_id: "", qty: 1, unit_cost: 0 }]);
    load();
  };

  // Form helpers (review step + wizard nav).
  const formValidLines = lines.filter((l) => l.product_id && l.qty > 0);
  const formTotal = formValidLines.reduce((s, l) => s + l.qty * l.unit_cost, 0);

  const nextPoStep = () => {
    setError(null);
    if (formStep === 1 && formValidLines.length === 0)
      return setError("נא להוסיף לפחות שורה אחת עם מוצר וכמות.");
    setFormStep((s) => s + 1);
  };

  const onPoSubmit = (e: React.FormEvent) => {
    if (formStep < 2) {
      e.preventDefault();
      nextPoStep();
    } else {
      save(e);
    }
  };

  const openForm = () => {
    setError(null);
    setFormStep(0);
    setShowForm((v) => !v);
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
        <button onClick={openForm} className={showForm ? "btn-outline" : "btn-gold"}>
          {showForm ? "ביטול" : "+ הזמנת רכש חדשה"}
        </button>
      </div>

      {error && (
        <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      {/* ── Smart replenishment ──────────────────────────────────────── */}
      {suggestions.length > 0 && (
        <section className="rounded-2xl border border-gold/30 bg-gold-50/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-navy-dark">
                <span>💡</span> הצעת רכש חכמה
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {suggestions.length}
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                מוצרים מתחת לנקודת ההזמנה, עם כמות מומלצת לפי קצב המכירות שלהם.
              </p>
            </div>
            <button
              onClick={fillFromSuggestions}
              disabled={pickedSuggestions.length === 0}
              className="btn-primary disabled:opacity-40"
            >
              מלא טופס רכש ({pickedSuggestions.length})
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="p-2"></th>
                  <th className="p-2">מוצר</th>
                  <th className="p-2">מלאי / נק׳</th>
                  <th className="p-2">צפי אוזל</th>
                  <th className="p-2">כמות מומלצת</th>
                  <th className="p-2">עלות משוערת</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr key={s.product_id} className="border-t border-gold/20">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={!!picked[s.product_id]}
                        onChange={() =>
                          setPicked((p) => ({ ...p, [s.product_id]: !p[s.product_id] }))
                        }
                        className="h-4 w-4 accent-gold"
                        aria-label={`בחר ${s.name_he}`}
                      />
                    </td>
                    <td className="p-2 font-medium text-navy-dark">{s.name_he}</td>
                    <td className="p-2">
                      <span className="font-semibold text-rose-600">{s.stock}</span>
                      <span className="text-slate-400"> / {s.reorder_point}</span>
                    </td>
                    <td className="p-2 text-amber-600">
                      {s.daysLeft != null ? `~${s.daysLeft} ימים` : "—"}
                    </td>
                    <td className="p-2 font-bold text-navy-dark">{s.suggestedQty}</td>
                    <td className="p-2">{s.unitCost > 0 ? formatPrice(s.lineCost) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gold/30 font-bold text-navy-dark">
                  <td className="p-2" colSpan={5}>
                    סה״כ נבחר ({pickedSuggestions.length})
                  </td>
                  <td className="p-2">{formatPrice(suggestTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {showForm && (
        <form onSubmit={onPoSubmit} className="card space-y-5 p-5">
          <WizardStepper
            steps={PO_STEPS}
            current={formStep}
            onStepClick={(i) => {
              if (i <= formStep) setFormStep(i);
              else if (i === 1) setFormStep(1);
              else if (i === 2 && formValidLines.length) setFormStep(2);
            }}
          />

          <div key={formStep} className="animate-fade-up space-y-4">
          {/* Step 0 — supplier & meta */}
          {formStep === 0 && (
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
          )}

          {/* Step 1 — line items */}
          {formStep === 1 && (
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
          )}

          {/* Step 2 — review */}
          {formStep === 2 && (
          <div className="rounded-2xl border border-gold/20 bg-gold-50/40 p-4">
            <p className="eyebrow mb-2">סיכום ההזמנה</p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between border-b border-gold/10 py-1">
                <dt className="text-slate-500">ספק</dt>
                <dd className="font-medium text-navy-dark">{supplierName(supplierId)}</dd>
              </div>
              <div className="flex justify-between border-b border-gold/10 py-1">
                <dt className="text-slate-500">מס׳ הזמנה</dt>
                <dd className="font-medium text-navy-dark">{poNumber || "אוטומטי"}</dd>
              </div>
              <div className="flex justify-between border-b border-gold/10 py-1">
                <dt className="text-slate-500">מספר פריטים</dt>
                <dd className="font-medium text-navy-dark">{formValidLines.length}</dd>
              </div>
              <div className="flex justify-between py-1 text-base">
                <dt className="font-bold">עלות כוללת</dt>
                <dd className="font-bold text-brand-dark">{formatPrice(formTotal)}</dd>
              </div>
            </dl>
          </div>
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
                {saving ? "שומר…" : "✓ יצירת הזמנת רכש"}
              </button>
            )}
          </div>
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
                  <div className="flex flex-wrap gap-3">
                    {(() => {
                      const link = poWaLink(po);
                      return link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                          שלח לספק
                        </a>
                      ) : null;
                    })()}
                    {po.status !== "received" && po.status !== "cancelled" && (
                      <>
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
                      </>
                    )}
                  </div>
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
