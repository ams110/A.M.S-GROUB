"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Supplier } from "@/lib/types";

const EMPTY = { name: "", contact: "", phone: "", email: "", notes: "" };

export default function AdminSuppliersPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("suppliers").select("*").order("name");
    setRows((data as Supplier[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("נא להזין שם ספק.");
    setSaving(true);
    const { error } = await supabase.from("suppliers").insert({
      name: form.name.trim(),
      contact: form.contact || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) return setError(error.message);
    setForm({ ...EMPTY });
    load();
  };

  const remove = async (s: Supplier) => {
    if (!confirm(`למחוק את הספק "${s.name}"?`)) return;
    setRows((r) => r.filter((x) => x.id !== s.id));
    await supabase.from("suppliers").delete().eq("id", s.id);
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">ספקים</h2>

      <form onSubmit={add} className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label">שם הספק *</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">איש קשר</label>
          <input
            className="input"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
          />
        </div>
        <div>
          <label className="label">טלפון</label>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="label">אימייל</label>
          <input
            className="input ltr-input"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="label">הערות</label>
          <input
            className="input"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        {error && (
          <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2 lg:col-span-3">
            {error}
          </p>
        )}
        <div>
          <button disabled={saving} className="btn-primary">
            {saving ? "מוסיף…" : "+ הוספת ספק"}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-slate-500">טוען…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="p-3">שם</th>
                <th className="p-3">איש קשר</th>
                <th className="p-3">טלפון</th>
                <th className="p-3">אימייל</th>
                <th className="p-3">הערות</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.contact ?? "—"}</td>
                  <td className="p-3">{s.phone ?? "—"}</td>
                  <td className="p-3">{s.email ?? "—"}</td>
                  <td className="p-3 text-slate-500">{s.notes ?? "—"}</td>
                  <td className="p-3">
                    <button
                      onClick={() => remove(s)}
                      className="text-slate-400 hover:text-rose-600"
                      title="מחיקה"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    אין ספקים עדיין.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
