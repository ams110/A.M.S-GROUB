"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, compactPrice } from "@/lib/format";
import {
  computeReceivablesByDealer,
  termDays,
  type AROrder,
  type DealerReceivables,
} from "@/lib/ar";
import { paymentReminderMessage, waMessageLink } from "@/lib/messages";
import { BASE_PATH } from "@/lib/config";

type DealerLite = {
  id: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  payment_terms: string | null;
};

// Compact accounts-receivable panel for the Operations Center: how much money
// is owed, how much is overdue, and the worst offenders — each with a one-tap
// WhatsApp reminder. All computed client-side from the AR engine (no DB change).
export default function ReceivablesPanel() {
  const [dealers, setDealers] = useState<DealerReceivables[]>([]);
  const [names, setNames] = useState<Record<string, DealerLite>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: orders }, { data: profs }] = await Promise.all([
        supabase.from("orders").select("dealer_id,total,payment_status,status,created_at"),
        supabase.from("profiles").select("id,full_name,company,phone,payment_terms").eq("role", "dealer"),
      ]);
      const list = (profs as DealerLite[]) ?? [];
      setNames(Object.fromEntries(list.map((p) => [p.id, p])));
      const termsByDealer = Object.fromEntries(list.map((p) => [p.id, termDays(p.payment_terms)]));
      setDealers(
        computeReceivablesByDealer((orders as (AROrder & { dealer_id: string })[]) ?? [], termsByDealer)
      );
      setLoading(false);
    })();
  }, []);

  const totalOutstanding = dealers.reduce((s, d) => s + d.outstanding, 0);
  const totalOverdue = dealers.reduce((s, d) => s + d.overdue, 0);
  const overdueDealers = dealers.filter((d) => d.overdue > 0);

  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}${BASE_PATH}/` : "";

  const reminderLink = (d: DealerReceivables) => {
    const p = names[d.dealerId];
    if (!p?.phone) return null;
    return waMessageLink(
      p.phone,
      paymentReminderMessage({
        name: p.full_name || p.company || undefined,
        amount: d.outstanding,
        overdue: d.overdue,
        oldestOverdueDays: d.oldestOverdueDays,
        loginUrl,
      })
    );
  };

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-navy-dark">
          גביית חובות
          {overdueDealers.length > 0 && (
            <span className="mr-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
              {overdueDealers.length} באיחור
            </span>
          )}
        </h3>
        <Link href="/admin/dealers" className="text-sm text-brand hover:underline">
          ללקוחות
        </Link>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">טוען…</p>
      ) : totalOutstanding <= 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">אין חובות פתוחים 👍</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">סה״כ חוב פתוח</p>
              <p className="mt-0.5 text-xl font-extrabold text-navy-dark">{compactPrice(totalOutstanding)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3">
              <p className="text-xs text-rose-600">מתוכו באיחור</p>
              <p className="mt-0.5 text-xl font-extrabold text-rose-600">{compactPrice(totalOverdue)}</p>
            </div>
          </div>

          {overdueDealers.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">אין חובות באיחור — הכול בתוך תנאי התשלום.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {overdueDealers.slice(0, 6).map((d) => {
                const p = names[d.dealerId];
                const link = reminderLink(d);
                return (
                  <li key={d.dealerId} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-dark">
                        {p?.company || p?.full_name || "—"}
                      </p>
                      <p className="text-xs text-rose-600">
                        באיחור {formatPrice(d.overdue)}
                        {d.oldestOverdueDays ? ` · ${d.oldestOverdueDays} ימים` : ""}
                      </p>
                    </div>
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        תזכורת
                      </a>
                    ) : (
                      <span className="shrink-0 text-xs text-slate-300">אין טלפון</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
