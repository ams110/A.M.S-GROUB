"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import {
  CUSTOMER_TYPE_HE,
  PAYMENT_TERMS_HE,
  PROFILE_STATUS_HE,
  formatPrice,
} from "@/lib/format";
import {
  computeReceivables,
  termDays,
  type AROrder,
  type Receivables,
} from "@/lib/ar";
import { paymentReminderMessage, waMessageLink } from "@/lib/messages";
import { genPassword, passwordResetMessage, waLink } from "@/lib/onboarding";
import { BASE_PATH } from "@/lib/config";
import type { CustomerType, PaymentTerms, Profile } from "@/lib/types";

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
  const toast = useToast();
  const [rows, setRows] = useState<Profile[]>([]);
  const [receivables, setReceivables] = useState<Record<string, Receivables>>({});
  const [loading, setLoading] = useState(true);
  // New password per dealer after an admin reset (shown once, copyable).
  const [resetPw, setResetPw] = useState<Record<string, string>>({});
  const [resettingId, setResettingId] = useState<string | null>(null);

  // Create-account form.
  const [form, setForm] = useState({ ...EMPTY_NEW });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

  const load = async () => {
    const [{ data }, { data: orders }] = await Promise.all([
      // Customers only (dealers + contractors all carry role "dealer").
      // Admins/super-admins are managed in /admin/admins, not here.
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "dealer")
        .order("created_at", { ascending: false }),
      supabase.from("orders").select("dealer_id,total,payment_status,status,created_at"),
    ]);
    const profs = (data as Profile[]) ?? [];
    setRows(profs);

    // Receivables per customer: outstanding + overdue + aging, using each
    // dealer's own payment terms (immediate / net30 / net60).
    const byDealer = new Map<string, AROrder[]>();
    for (const o of (orders ?? []) as (AROrder & { dealer_id: string })[]) {
      const arr = byDealer.get(o.dealer_id) ?? [];
      arr.push(o);
      byDealer.set(o.dealer_id, arr);
    }
    const rec: Record<string, Receivables> = {};
    for (const p of profs) {
      const list = byDealer.get(p.id);
      if (list && list.length) rec[p.id] = computeReceivables(list, termDays(p.payment_terms));
    }
    setReceivables(rec);
    setLoading(false);
  };

  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}${BASE_PATH}/` : "";

  const remindLink = (p: Profile) => {
    const r = receivables[p.id];
    if (!p.phone || !r || r.outstanding <= 0) return null;
    const msg = paymentReminderMessage({
      name: p.full_name || p.company || undefined,
      amount: r.outstanding,
      overdue: r.overdue,
      oldestOverdueDays: r.oldestOverdueDays,
      loginUrl,
    });
    return waMessageLink(p.phone, msg);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: string, status: Profile["status"]) => {
    setRows((r) => r.map((p) => (p.id === id ? { ...p, status } : p)));
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) toast("שגיאה בעדכון הסטטוס", "error");
    else toast(status === "approved" ? "הלקוח אושר" : "הלקוח נדחה");
  };

  const setType = async (id: string, customer_type: CustomerType) => {
    setRows((r) => r.map((p) => (p.id === id ? { ...p, customer_type } : p)));
    await supabase.from("profiles").update({ customer_type }).eq("id", id);
  };

  // Local edit; persist on blur (credit limit) or change (terms).
  const patchLocal = (id: string, p: Partial<Profile>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const saveCredit = async (id: string, credit_limit: number) => {
    await supabase.from("profiles").update({ credit_limit }).eq("id", id);
  };

  const saveUsername = async (id: string, username: string) => {
    const val = username.trim().toLowerCase() || null;
    const { error } = await supabase.from("profiles").update({ username: val }).eq("id", id);
    if (error) {
      toast(
        error.message.includes("unique") ? "שם המשתמש כבר תפוס" : "שגיאה בשמירת שם המשתמש",
        "error"
      );
      load();
    }
  };

  const setTerms = async (id: string, payment_terms: PaymentTerms) => {
    patchLocal(id, { payment_terms });
    await supabase.from("profiles").update({ payment_terms }).eq("id", id);
  };

  // Reset a dealer's password to a freshly generated one (admin-only edge
  // function). The new password is shown once so the admin can copy / WhatsApp it.
  const resetPassword = async (p: Profile) => {
    if (!confirm(`לאפס את הסיסמה של ${p.full_name || p.company || "הלקוח"}? תיווצר סיסמה חדשה.`)) return;
    setResettingId(p.id);
    const pw = genPassword();
    const { data, error } = await supabase.functions.invoke("admin-reset-password", {
      body: { user_id: p.id, password: pw },
    });
    setResettingId(null);
    if (error || data?.error) {
      toast("איפוס הסיסמה נכשל", "error");
      return;
    }
    setResetPw((r) => ({ ...r, [p.id]: pw }));
    toast("הסיסמה אופסה");
  };

  // The "new password" box shown after a reset — copyable + WhatsApp.
  const resetBox = (p: Profile) =>
    resetPw[p.id] ? (
      <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500">סיסמה חדשה:</span>
          <code className="font-mono font-bold text-navy-dark">{resetPw[p.id]}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(resetPw[p.id]);
              toast("הסיסמה הועתקה");
            }}
            className="text-brand hover:underline"
          >
            העתק
          </button>
          {p.phone && (
            <a
              href={waLink(
                p.phone,
                passwordResetMessage({
                  name: p.full_name || p.company || undefined,
                  loginUrl,
                  login: p.username || "האימייל שלך",
                  password: resetPw[p.id],
                })
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 hover:underline"
            >
              שלח בוואטסאפ
            </a>
          )}
        </div>
      </div>
    ) : null;

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
    toast(`החשבון נוצר בהצלחה: ${form.email}`);
    setForm({ ...EMPTY_NEW });
    load();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">לקוחות — סוחרים וקבלנים</h2>
        <Link href="/admin/dealers/new" className="btn-primary whitespace-nowrap">
          ✨ הוספת לקוח (אשף)
        </Link>
      </div>

      {/* Quick create (the full guided flow with WhatsApp lives in /admin/dealers/new) */}
      <details className="card mb-6 p-5">
        <summary className="cursor-pointer font-bold text-slate-600">
          פתיחת חשבון מהירה
        </summary>
        <form onSubmit={createCustomer} className="mt-4 space-y-4">
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
      </details>

      {loading ? (
        <p className="text-slate-500">טוען…</p>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="p-3">שם</th>
                  <th className="p-3">חברה</th>
                  <th className="p-3">טלפון</th>
                  <th className="p-3">שם משתמש</th>
                  <th className="p-3">סוג</th>
                  <th className="p-3">מסגרת אשראי</th>
                  <th className="p-3">תנאי תשלום</th>
                  <th className="p-3">חוב פתוח</th>
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
                      <input
                        type="text"
                        className="input w-28 py-1 ltr-input"
                        dir="ltr"
                        placeholder="username"
                        defaultValue={p.username ?? ""}
                        onBlur={(e) => saveUsername(p.id, e.target.value)}
                      />
                    </td>
                    <td className="p-3">
                      {p.role === "super_admin" ? (
                        <span className="badge bg-purple-100 text-purple-800">מנהל ראשי</span>
                      ) : p.role === "admin" ? (
                        <span className="badge bg-blue-100 text-blue-800">מנהל</span>
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
                      {p.role === "dealer" && (
                        <input
                          type="number"
                          className="input w-28 py-1"
                          value={p.credit_limit}
                          onChange={(e) => patchLocal(p.id, { credit_limit: Number(e.target.value) })}
                          onBlur={(e) => saveCredit(p.id, Number(e.target.value))}
                        />
                      )}
                    </td>
                    <td className="p-3">
                      {p.role === "dealer" && (
                        <select
                          className="input w-28 py-1"
                          value={p.payment_terms}
                          onChange={(e) => setTerms(p.id, e.target.value as PaymentTerms)}
                        >
                          <option value="immediate">{PAYMENT_TERMS_HE.immediate}</option>
                          <option value="net30">{PAYMENT_TERMS_HE.net30}</option>
                          <option value="net60">{PAYMENT_TERMS_HE.net60}</option>
                        </select>
                      )}
                    </td>
                    <td className="p-3">
                      {p.role === "dealer" && (() => {
                        const r = receivables[p.id];
                        const bal = r?.outstanding ?? 0;
                        if (bal <= 0) return <span className="text-slate-300">—</span>;
                        const over = p.credit_limit > 0 && bal > p.credit_limit;
                        return (
                          <div className={over ? "font-bold text-rose-600" : ""}>
                            <span>{formatPrice(bal)}{over && " ⚠"}</span>
                            {r && r.overdue > 0 && (
                              <span className="mt-0.5 block text-xs font-semibold text-rose-600">
                                באיחור {formatPrice(r.overdue)}
                                {r.oldestOverdueDays ? ` · ${r.oldestOverdueDays} ימים` : ""}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-3">
                      <span className={`badge ${
                        p.status === "approved" ? "bg-emerald-50 text-emerald-700"
                        : p.status === "rejected" ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700"
                      }`}>
                        {PROFILE_STATUS_HE[p.status]}
                      </span>
                    </td>
                    <td className="p-3">
                      {p.role === "dealer" && (
                        <>
                        <div className="flex flex-wrap gap-2">
                          {p.status !== "approved" && (
                            <button onClick={() => setStatus(p.id, "approved")} className="text-emerald-700 hover:underline">אישור</button>
                          )}
                          {p.status !== "rejected" && (
                            <button onClick={() => setStatus(p.id, "rejected")} className="text-rose-700 hover:underline">דחייה</button>
                          )}
                          <Link href={`/admin/customer?id=${p.id}`} className="font-semibold text-gold-dark hover:underline">תיק לקוח</Link>
                          <Link href={`/admin/customer-prices?customer=${p.id}`} className="text-brand hover:underline">מחירים</Link>
                          <button onClick={() => resetPassword(p)} disabled={resettingId === p.id} className="text-amber-700 hover:underline">
                            {resettingId === p.id ? "מאפס…" : "איפוס סיסמה"}
                          </button>
                          {(() => {
                            const link = remindLink(p);
                            return link ? (
                              <a href={link} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline">
                                תזכורת תשלום
                              </a>
                            ) : null;
                          })()}
                        </div>
                        {resetBox(p)}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={10} className="p-6 text-center text-slate-400">אין לקוחות עדיין.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className="space-y-3 md:hidden">
            {rows.length === 0 && (
              <p className="py-10 text-center text-slate-400">אין לקוחות עדיין.</p>
            )}
            {rows.map((p) => (
              <div key={p.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{p.full_name ?? "—"}</p>
                    <p className="text-xs text-slate-500">{p.company ?? ""}</p>
                  </div>
                  <span className={`badge shrink-0 ${
                    p.status === "approved" ? "bg-emerald-50 text-emerald-700"
                    : p.status === "rejected" ? "bg-rose-50 text-rose-700"
                    : "bg-amber-50 text-amber-700"
                  }`}>
                    {PROFILE_STATUS_HE[p.status]}
                  </span>
                </div>
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="block text-sm text-brand">{p.phone}</a>
                )}
                {p.role === "dealer" && (() => {
                  const r = receivables[p.id];
                  const bal = r?.outstanding ?? 0;
                  const over = p.credit_limit > 0 && bal > p.credit_limit;
                  return bal > 0 ? (
                    <p className={`text-sm ${over ? "font-bold text-rose-600" : "text-slate-600"}`}>
                      חוב פתוח: {formatPrice(bal)}{over && " ⚠"}
                      {r && r.overdue > 0 && (
                        <span className="block text-xs font-semibold text-rose-600">
                          באיחור {formatPrice(r.overdue)}
                          {r.oldestOverdueDays ? ` · ${r.oldestOverdueDays} ימים` : ""}
                        </span>
                      )}
                    </p>
                  ) : null;
                })()}
                {p.role === "dealer" && (
                  <>
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                    {p.status !== "approved" && (
                      <button onClick={() => setStatus(p.id, "approved")} className="btn-outline py-1 text-xs text-emerald-700 border-emerald-300">אישור</button>
                    )}
                    {p.status !== "rejected" && (
                      <button onClick={() => setStatus(p.id, "rejected")} className="btn-outline py-1 text-xs text-rose-700 border-rose-300">דחייה</button>
                    )}
                    <Link href={`/admin/customer?id=${p.id}`} className="btn-outline py-1 text-xs text-gold-dark border-gold/40">תיק לקוח</Link>
                    <Link href={`/admin/customer-prices?customer=${p.id}`} className="btn-outline py-1 text-xs">מחירים</Link>
                    <button onClick={() => resetPassword(p)} disabled={resettingId === p.id} className="btn-outline py-1 text-xs text-amber-700 border-amber-300">
                      {resettingId === p.id ? "מאפס…" : "איפוס סיסמה"}
                    </button>
                    {(() => {
                      const link = remindLink(p);
                      return link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="btn-outline py-1 text-xs text-emerald-700 border-emerald-300">תזכורת תשלום</a>
                      ) : null;
                    })()}
                  </div>
                  {resetBox(p)}
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
