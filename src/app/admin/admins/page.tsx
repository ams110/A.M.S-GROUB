"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import type { Profile } from "@/lib/types";

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-gold/15 text-gold-dark border border-gold/30",
  admin: "bg-navy/10 text-navy border border-navy/20",
  dealer: "bg-slate-100 text-slate-600",
};

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  pending: "bg-amber-50 text-amber-700",
};

const STATUS_HE: Record<string, string> = {
  approved: "מאושר",
  rejected: "נדחה",
  pending: "ממתין",
};

const EMPTY_FORM = { email: "", password: "", full_name: "", company: "" };

export default function AdminsPage() {
  const { profile: me, ready, isSuperAdmin } = useProfile();
  const supabase = createClient();
  const toast = useToast();

  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Create admin form
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("role", { ascending: false });
    setRows((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (ready && isSuperAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!form.email || form.password.length < 6) {
      setCreateError("נא להזין אימייל וסיסמה (לפחות 6 תווים)");
      return;
    }
    setCreating(true);

    // Step 1: Create auth user via edge function
    const { data, error } = await supabase.functions.invoke("admin-create-customer", {
      body: { ...form, customer_type: "dealer" },
    });

    if (error || data?.error) {
      const msg = data?.message || data?.error || error?.message || "";
      setCreateError(
        /already.*registered|exists/i.test(msg)
          ? "האימייל כבר רשום במערכת."
          : `שגיאה: ${msg}`
      );
      setCreating(false);
      return;
    }

    // Step 2: Promote to admin
    const { error: roleErr } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", data.id);

    if (roleErr) {
      setCreateError("החשבון נוצר אך שגיאה בהגדרת הרשאות — נסה לקדם ידנית מהרשימה");
      setCreating(false);
      load();
      return;
    }

    toast(`המנהל ${form.email} נוצר בהצלחה`);
    setForm({ ...EMPTY_FORM });
    setCreating(false);
    load();
  };

  const setRole = async (id: string, newRole: "admin" | "dealer") => {
    setRows((r) => r.map((p) => (p.id === id ? { ...p, role: newRole } : p)));
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", id);
    if (error) {
      toast("שגיאה בעדכון ההרשאה", "error");
      load();
    } else {
      toast(newRole === "admin" ? "המשתמש קודם למנהל" : "הרשאות הניהול הוסרו");
    }
  };

  if (!ready) return <div className="py-20 text-center text-slate-500">טוען…</div>;

  if (!isSuperAdmin) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium text-rose-600">גישה מוגבלת למנהל ראשי בלבד.</p>
      </div>
    );
  }

  const currentAdmins = rows.filter((p) => p.role === "admin");
  const dealers = rows.filter((p) => p.role === "dealer");

  return (
    <div className="space-y-8 animate-fade-up">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-navy-dark">ניהול הרשאות מנהלים</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          כמנהל ראשי, ביכולתך ליצור מנהלים חדשים או לשנות הרשאות משתמשים קיימים.
        </p>
      </div>

      {/* ── Create admin form ────────────────────────────────────────── */}
      <form onSubmit={createAdmin} className="card p-6 stagger-1 animate-fade-up">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/10">
            <span className="text-base">➕</span>
          </div>
          <h3 className="font-semibold text-navy-dark">יצירת חשבון מנהל חדש</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">אימייל *</label>
            <input
              type="email"
              className="input ltr-input"
              dir="ltr"
              placeholder="admin@example.com"
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
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label">שם מלא</label>
            <input
              className="input"
              placeholder="ישראל ישראלי"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">חברה</label>
            <input
              className="input"
              placeholder="שם החברה"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>
        </div>

        {createError && (
          <div className="mt-4 animate-slide-down rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {createError}
          </div>
        )}

        <div className="mt-4">
          <button disabled={creating} className="btn-gold">
            {creating ? "יוצר…" : "צור חשבון מנהל"}
          </button>
        </div>
      </form>

      {/* ── Current admins ───────────────────────────────────────────── */}
      <section className="stagger-2 animate-fade-up">
        <h3 className="mb-3 font-semibold text-slate-700">מנהלים פעילים</h3>
        <div className="card overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="p-3">שם</th>
                <th className="p-3">חברה</th>
                <th className="p-3">תפקיד</th>
                <th className="p-3">פעולה</th>
              </tr>
            </thead>
            <tbody>
              {/* Super admin row (self) */}
              {me && (
                <tr className="border-b border-slate-100 bg-gold/5">
                  <td className="p-3 font-medium text-navy-dark">
                    {me.full_name ?? "—"}
                    <span className="mr-2 text-xs text-gold-dark">(אתה)</span>
                  </td>
                  <td className="p-3 text-slate-600">{me.company ?? "—"}</td>
                  <td className="p-3">
                    <span className={`badge ${ROLE_BADGE.super_admin}`}>מנהל ראשי</span>
                  </td>
                  <td className="p-3 text-xs text-slate-400">לא ניתן לשנות</td>
                </tr>
              )}

              {loading ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-400">טוען…</td></tr>
              ) : currentAdmins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    אין מנהלים נוספים. צור חשבון מנהל למעלה או קדם משתמש מהרשימה למטה.
                  </td>
                </tr>
              ) : (
                currentAdmins.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 font-medium">{p.full_name ?? "—"}</td>
                    <td className="p-3 text-slate-600">{p.company ?? "—"}</td>
                    <td className="p-3">
                      <span className={`badge ${ROLE_BADGE.admin}`}>מנהל</span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setRole(p.id, "dealer")}
                        className="text-sm text-rose-600 hover:underline transition-colors"
                      >
                        הסרת הרשאות
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Dealers — promote ────────────────────────────────────────── */}
      <section className="stagger-3 animate-fade-up">
        <h3 className="mb-1 font-semibold text-slate-700">משתמשים — מתן הרשאות ניהול</h3>
        <p className="mb-3 text-xs text-slate-500">
          מנהל יכול לגשת לכל ממשק הניהול, אך לא יכול לשנות הרשאות.
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="p-3">שם</th>
                <th className="p-3">חברה</th>
                <th className="p-3">סטטוס</th>
                <th className="p-3">פעולה</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-400">טוען…</td></tr>
              ) : dealers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">אין משתמשים נוספים.</td>
                </tr>
              ) : (
                dealers.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 font-medium">{p.full_name ?? "—"}</td>
                    <td className="p-3 text-slate-600">{p.company ?? "—"}</td>
                    <td className="p-3">
                      <span className={`badge ${STATUS_BADGE[p.status]}`}>
                        {STATUS_HE[p.status]}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setRole(p.id, "admin")}
                        className="text-sm font-medium text-navy hover:text-gold transition-colors hover:underline"
                      >
                        הענק הרשאות ניהול
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
