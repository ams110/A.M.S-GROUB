"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CUSTOMER_TYPE_HE, PROFILE_STATUS_HE } from "@/lib/format";
import type { CustomerType, Profile } from "@/lib/types";

const EMPTY_NEW = {
  email: "",
  password: "",
  full_name: "",
  company: "",
  phone: "",
  customer_type: "dealer" as CustomerType,
};

export default function AdminCustomersPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Create-account form.
  const [form, setForm] = useState({ ...EMPTY_NEW });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: string, status: Profile["status"]) => {
    setRows((r) => r.map((p) => (p.id === id ? { ...p, status } : p)));
    await supabase.from("profiles").update({ status }).eq("id", id);
  };

  const setType = async (id: string, customer_type: CustomerType) => {
    setRows((r) => r.map((p) => (p.id === id ? { ...p, customer_type } : p)));
    await supabase.from("profiles").update({ customer_type }).eq("id", id);
  };

  const createCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateOk(null);
    if (!form.email || form.password.length < 6) {
      setCreateError("נא להזין אימייל וסיסמה (לפחות 6 תווים).");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-customer", {
      body: form,
    });
    setCreating(false);

    if (error || data?.error) {
      const msg = data?.message || data?.error || error?.message || "";
      setCreateError(
        /already.*registered|exists/i.test(msg)
          ? "האימייל כבר רשום במערכת."
          : `יצירת החשבון נכשלה: ${msg}`
      );
      return;
    }
    setCreateOk(`החשבון נוצר: ${form.email}`);
    setForm({ ...EMPTY_NEW });
    load();
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">לקוחות — סוחרים וקבלנים</h2>

      {/* Create account */}
      <form onSubmit={createCustomer} className="card mb-6 space-y-4 p-5">
        <h3 className="font-bold">פתיחת חשבון ללקוח</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">אימייל *</label>
            <input
              type="email"
              className="input ltr-input"
              dir="ltr"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">סיסמה * (לפחות 6 תווים)</label>
            <input
              type="text"
              className="input ltr-input"
              dir="ltr"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label">סוג לקוח</label>
            <select
              className="input"
              value={form.customer_type}
              onChange={(e) =>
                setForm({ ...form, customer_type: e.target.value as CustomerType })
              }
            >
              <option value="dealer">סוחר</option>
              <option value="contractor">קבלן</option>
            </select>
          </div>
          <div>
            <label className="label">שם איש קשר</label>
            <input
              className="input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">חברה / עסק</label>
            <input
              className="input"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
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
        </div>
        {createError && (
          <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{createError}</p>
        )}
        {createOk && (
          <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {createOk} — החשבון מאושר ומוכן לכניסה.
          </p>
        )}
        <button disabled={creating} className="btn-primary">
          {creating ? "יוצר…" : "פתיחת חשבון"}
        </button>
      </form>

      {loading ? (
        <p className="text-slate-500">טוען…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="p-3">שם</th>
                <th className="p-3">חברה</th>
                <th className="p-3">טלפון</th>
                <th className="p-3">סוג</th>
                <th className="p-3">סטטוס</th>
                <th className="p-3">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="p-3 font-medium">{p.full_name ?? "—"}</td>
                  <td className="p-3">{p.company ?? "—"}</td>
                  <td className="p-3">{p.phone ?? "—"}</td>
                  <td className="p-3">
                    {p.role === "admin" ? (
                      <span className="badge bg-slate-100 text-slate-700">מנהל</span>
                    ) : (
                      <select
                        className="input w-28 py-1"
                        value={p.customer_type}
                        onChange={(e) => setType(p.id, e.target.value as CustomerType)}
                      >
                        <option value="dealer">{CUSTOMER_TYPE_HE.dealer}</option>
                        <option value="contractor">{CUSTOMER_TYPE_HE.contractor}</option>
                      </select>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`badge ${
                        p.status === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : p.status === "rejected"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {PROFILE_STATUS_HE[p.status]}
                    </span>
                  </td>
                  <td className="p-3">
                    {p.role !== "admin" && (
                      <div className="flex gap-2">
                        {p.status !== "approved" && (
                          <button
                            onClick={() => setStatus(p.id, "approved")}
                            className="text-emerald-700 hover:underline"
                          >
                            אישור
                          </button>
                        )}
                        {p.status !== "rejected" && (
                          <button
                            onClick={() => setStatus(p.id, "rejected")}
                            className="text-rose-700 hover:underline"
                          >
                            דחייה
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    אין לקוחות עדיין.
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
