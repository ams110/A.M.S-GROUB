"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, compactPrice } from "@/lib/format";
import {
  findDormantDealers,
  findDeadStock,
  type ActivityOrder,
  type DormantDealer,
  type DeadStock,
  type DeadStockProduct,
} from "@/lib/activity";
import { winBackMessage, waMessageLink } from "@/lib/messages";
import { BASE_PATH } from "@/lib/config";

type DealerLite = { id: string; full_name: string | null; company: string | null; phone: string | null };

const DAY = 24 * 60 * 60 * 1000;

// Two money problems, one recency engine: dealers who went quiet (revenue to
// win back) and stock that isn't moving (capital to free up).
export default function OpportunitiesPanel() {
  const [dormant, setDormant] = useState<DormantDealer[]>([]);
  const [dead, setDead] = useState<DeadStock[]>([]);
  const [names, setNames] = useState<Record<string, DealerLite>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const since90 = new Date(Date.now() - 90 * DAY).toISOString();
      const [{ data: orders }, { data: dealers }, { data: products }] = await Promise.all([
        supabase.from("orders").select("id,dealer_id,created_at,status,total"),
        supabase.from("profiles").select("id,full_name,company,phone").eq("role", "dealer"),
        supabase.from("products").select("id,name_he,stock,cost").is("deleted_at", null),
      ]);

      const orderList = (orders as (ActivityOrder & { id: string })[]) ?? [];
      const recentIds = orderList.filter((o) => o.created_at >= since90).map((o) => o.id);
      let items: { order_id: string; product_id: string | null; qty: number }[] = [];
      if (recentIds.length) {
        const { data } = await supabase
          .from("order_items")
          .select("order_id,product_id,qty")
          .in("order_id", recentIds);
        items = (data as typeof items) ?? [];
      }

      setNames(Object.fromEntries(((dealers as DealerLite[]) ?? []).map((d) => [d.id, d])));
      setDormant(findDormantDealers(orderList));
      setDead(
        findDeadStock(
          (products as DeadStockProduct[]) ?? [],
          orderList.map((o) => ({ id: o.id, created_at: o.created_at, status: o.status })),
          items,
          { staleDays: 60 }
        )
      );
      setLoading(false);
    })();
  }, []);

  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}${BASE_PATH}/` : "";
  const frozenCapital = dead.reduce((s, d) => s + d.tiedCapital, 0);

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card h-40 animate-pulse bg-black/5" />
        <div className="card h-40 animate-pulse bg-black/5" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Dormant dealers — win-back */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-navy-dark">
            לקוחות שנרדמו
            {dormant.length > 0 && (
              <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {dormant.length}
              </span>
            )}
          </h3>
          <Link href="/admin/dealers" className="text-sm text-brand hover:underline">ללקוחות</Link>
        </div>
        {dormant.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">כל הלקוחות הפעילים מזמינים בקצב 👍</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dormant.slice(0, 6).map((d) => {
              const p = names[d.dealerId];
              const link = p?.phone
                ? waMessageLink(
                    p.phone,
                    winBackMessage({
                      name: p.full_name || p.company || undefined,
                      daysSinceLastOrder: d.daysSinceLast,
                      loginUrl,
                    })
                  )
                : null;
              return (
                <li key={d.dealerId} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-dark">
                      {p?.company || p?.full_name || "—"}
                    </p>
                    <p className="text-xs text-amber-600">
                      לא הזמין {d.daysSinceLast} ימים · בד״כ כל ~{d.avgIntervalDays}
                    </p>
                  </div>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      בוא נחזיר
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-300">אין טלפון</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Dead stock — frozen capital */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-navy-dark">
            מלאי תקוע
            {dead.length > 0 && (
              <span className="mr-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                {dead.length}
              </span>
            )}
          </h3>
          <Link href="/admin/inventory" className="text-sm text-brand hover:underline">למלאי</Link>
        </div>
        {dead.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">אין מלאי תקוע — הכול זז 👍</p>
        ) : (
          <>
            {frozenCapital > 0 && (
              <div className="mb-3 rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">הון תקוע על המדף (60 יום ללא מכירה)</p>
                <p className="mt-0.5 text-xl font-extrabold text-navy-dark">{compactPrice(frozenCapital)}</p>
              </div>
            )}
            <ul className="divide-y divide-slate-100">
              {dead.slice(0, 6).map((d) => (
                <li key={d.productId} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-dark">{d.name_he}</p>
                    <p className="text-xs text-slate-400">
                      {d.stock} במלאי
                      {d.daysSinceSold != null ? ` · נמכר לאחרונה לפני ${d.daysSinceSold} ימים` : " · לא נמכר לאחרונה"}
                    </p>
                  </div>
                  {d.tiedCapital > 0 && (
                    <span className="shrink-0 text-sm font-bold text-rose-600">{formatPrice(d.tiedCapital)}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
