"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_STATUS_HE } from "@/lib/format";
import type { Profile } from "@/lib/types";

export default function AdminDealersPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("tiandy_il_profiles")
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
    await supabase.from("tiandy_il_profiles").update({ status }).eq("id", id);
  };

  if (loading) return <p className="text-slate-500">טוען…</p>;

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">חשבונות סוחרים</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-3">שם</th>
              <th className="p-3">חברה</th>
              <th className="p-3">טלפון</th>
              <th className="p-3">תפקיד</th>
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
                <td className="p-3">{p.role === "admin" ? "מנהל" : "סוחר"}</td>
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
                  אין סוחרים עדיין.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
