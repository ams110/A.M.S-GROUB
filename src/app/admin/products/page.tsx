"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types";

type Draft = { price: number; stock: number; min_order_qty: number; is_orderable: boolean };

export default function AdminProductsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .is("deleted_at", null)
      .order("sort");
    setRows((data as Product[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (id: string, p: Partial<Draft>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const save = async (p: Product) => {
    setSavingId(p.id);
    await supabase
      .from("products")
      .update({
        price: p.price,
        stock: p.stock,
        min_order_qty: p.min_order_qty,
        is_orderable: p.is_orderable,
      })
      .eq("id", p.id);
    setSavingId(null);
    setSavedId(p.id);
    setTimeout(() => setSavedId((s) => (s === p.id ? null : s)), 1500);
  };

  if (loading) return <p className="text-slate-500">טוען…</p>;

  const filtered = rows.filter((p) =>
    p.name_he.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">מוצרים — מחירים ומלאי</h2>
        <input
          placeholder="חיפוש…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input max-w-xs"
        />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-3">מוצר</th>
              <th className="p-3">מחיר (₪)</th>
              <th className="p-3">מלאי</th>
              <th className="p-3">מינ׳ הזמנה</th>
              <th className="p-3">למכירה</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="p-3">
                  <div className="font-medium">{p.name_he}</div>
                  {p.sku && <div className="text-xs text-slate-400">{p.sku}</div>}
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={p.price}
                    onChange={(e) => patch(p.id, { price: Number(e.target.value) })}
                    className="input w-28 py-1"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={p.stock}
                    onChange={(e) => patch(p.id, { stock: Number(e.target.value) })}
                    className="input w-20 py-1"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={p.min_order_qty}
                    onChange={(e) =>
                      patch(p.id, { min_order_qty: Number(e.target.value) })
                    }
                    className="input w-20 py-1"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={p.is_orderable}
                    onChange={(e) => patch(p.id, { is_orderable: e.target.checked })}
                  />
                </td>
                <td className="p-3">
                  <button
                    onClick={() => save(p)}
                    disabled={savingId === p.id}
                    className="btn-outline py-1"
                  >
                    {savingId === p.id
                      ? "שומר…"
                      : savedId === p.id
                      ? "נשמר ✓"
                      : "שמירה"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
