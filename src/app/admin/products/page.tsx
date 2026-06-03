"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { asset } from "@/lib/config";
import type { Product } from "@/lib/types";

type Draft = { price: number; stock: number; min_order_qty: number; is_orderable: boolean };

export default function AdminProductsPage() {
  const supabase = createClient();
  const toast = useToast();
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
    const { error } = await supabase
      .from("products")
      .update({
        price: p.price,
        stock: p.stock,
        min_order_qty: p.min_order_qty,
        is_orderable: p.is_orderable,
      })
      .eq("id", p.id);
    setSavingId(null);
    if (error) {
      toast("שגיאה בשמירה", "error");
    } else {
      setSavedId(p.id);
      setTimeout(() => setSavedId((s) => (s === p.id ? null : s)), 1500);
      toast(`"${p.name_he}" נשמר`);
    }
  };

  const toggleFeatured = async (p: Product) => {
    const next = !p.is_featured;
    setRows((r) => r.map((x) => (x.id === p.id ? { ...x, is_featured: next } : x)));
    await supabase.from("products").update({ is_featured: next }).eq("id", p.id);
  };

  // Soft delete: keep the row but hide it from the storefront (deleted_at).
  const remove = async (p: Product) => {
    if (!confirm(`למחוק את "${p.name_he}"? המוצר יוסר מהקטלוג.`)) return;
    setRows((r) => r.filter((x) => x.id !== p.id));
    await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", p.id);
  };

  if (loading) return <p className="text-slate-500">טוען…</p>;

  const filtered = rows.filter((p) =>
    `${p.name_he} ${p.sku ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold">מוצרים — ניהול הקטלוג</h2>
        <div className="flex items-center gap-3">
          <input
            placeholder="חיפוש…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input max-w-xs"
          />
          <Link href="/admin/products/edit" className="btn-primary whitespace-nowrap">
            + מוצר חדש
          </Link>
        </div>
      </div>
      <p className="mb-3 text-sm text-slate-500">{filtered.length} מוצרים</p>
      <div className="card overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-3">מוצר</th>
              <th className="p-3">מחיר (₪)</th>
              <th className="p-3">מלאי</th>
              <th className="p-3">מינ׳ הזמנה</th>
              <th className="p-3">למכירה</th>
              <th className="p-3">מומלץ</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url ?? asset("/placeholder.svg")}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                    <div>
                      <div className="font-medium">{p.name_he}</div>
                      {p.sku && <div className="text-xs text-slate-400">{p.sku}</div>}
                    </div>
                  </div>
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
                    onClick={() => toggleFeatured(p)}
                    title="מוצר מומלץ בדף הבית"
                    className={`text-lg ${p.is_featured ? "" : "opacity-30"}`}
                  >
                    ★
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
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
                    <Link
                      href={`/admin/products/edit?id=${p.id}`}
                      className="text-brand hover:underline"
                    >
                      עריכה
                    </Link>
                    <button
                      onClick={() => remove(p)}
                      className="text-slate-400 hover:text-rose-600"
                      title="מחיקה"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
