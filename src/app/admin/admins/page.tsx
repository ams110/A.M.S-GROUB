"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import type { Profile } from "@/lib/types";

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  dealer: "bg-slate-100 text-slate-700",
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

export default function AdminsPage() {
  const { profile: me, ready, isSuperAdmin } = useProfile();
  const supabase = createClient();
  const toast = useToast();
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-lg font-bold">ניהול הרשאות מנהלים</h2>
        <p className="text-sm text-slate-500">
          כמנהל ראשי, ביכולתך להעניק או לשלול הרשאות ניהול ממשתמשים אחרים.
        </p>
      </div>

      {/* Current admins */}
      <section>
        <h3 className="mb-3 font-semibold text-slate-700">מנהלים פעילים</h3>
        <div className="card overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="p-3">שם</th>
                <th className="p-3">חברה</th>
                <th className="p-3">תפקיד</th>
                <th className="p-3">פעולה</th>
              </tr>
            </thead>
            <tbody>
              {/* Super admin (self) — always first, not editable */}
              {me && (
                <tr className="border-b border-slate-100 bg-purple-50/60">
                  <td className="p-3 font-medium">
                    {me.full_name ?? "—"}
                    <span className="mr-2 text-xs text-purple-500">(אתה)</span>
                  </td>
                  <td className="p-3">{me.company ?? "—"}</td>
                  <td className="p-3">
                    <span className={`badge ${ROLE_BADGE.super_admin}`}>מנהל ראשי</span>
                  </td>
                  <td className="p-3 text-xs text-slate-400">לא ניתן לשנות</td>
                </tr>
              )}
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">טוען…</td>
                </tr>
              ) : currentAdmins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">
                    אין מנהלים נוספים. קדם משתמש מהרשימה למטה.
                  </td>
                </tr>
              ) : (
                currentAdmins.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="p-3 font-medium">{p.full_name ?? "—"}</td>
                    <td className="p-3">{p.company ?? "—"}</td>
                    <td className="p-3">
                      <span className={`badge ${ROLE_BADGE.admin}`}>מנהל</span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setRole(p.id, "dealer")}
                        className="text-sm text-rose-600 hover:underline"
                      >
                        הסרת הרשאות ניהול
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dealers — promote to admin */}
      <section>
        <h3 className="mb-1 font-semibold text-slate-700">משתמשים — מתן הרשאות ניהול</h3>
        <p className="mb-3 text-xs text-slate-500">
          מנהל יכול לגשת לכל ממשק הניהול, אך לא יכול לשנות הרשאות.
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="p-3">שם</th>
                <th className="p-3">חברה</th>
                <th className="p-3">סטטוס</th>
                <th className="p-3">פעולה</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">טוען…</td>
                </tr>
              ) : dealers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">
                    אין משתמשים נוספים.
                  </td>
                </tr>
              ) : (
                dealers.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="p-3 font-medium">{p.full_name ?? "—"}</td>
                    <td className="p-3">{p.company ?? "—"}</td>
                    <td className="p-3">
                      <span className={`badge ${STATUS_BADGE[p.status]}`}>
                        {STATUS_HE[p.status]}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setRole(p.id, "admin")}
                        className="text-sm text-brand hover:underline"
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
