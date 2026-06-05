"use client";

/**
 * Reorder reminders — the outbound half of Smart Reorder.
 *
 * Scans every customer's order history and surfaces those now *due* to reorder
 * specific products (per their own cadence), with a ready WhatsApp message
 * listing their usual items + the typical quantity. The admin taps one button
 * to nudge them before they drift — retention turned into a one-tap action.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  findReorderDueCustomers,
  type ReminderOrder,
  type CustomerReorderReminder,
} from "@/lib/reorderReminders";
import type { ReorderItem } from "@/lib/reorder";
import { reorderReminderMessage, waMessageLink } from "@/lib/messages";
import { BASE_PATH } from "@/lib/config";

type DealerLite = {
  id: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
};

export default function ReorderRemindersPanel() {
  const [due, setDue] = useState<CustomerReorderReminder[]>([]);
  const [names, setNames] = useState<Record<string, DealerLite>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: orders }, { data: dealers }] = await Promise.all([
        supabase.from("orders").select("id,dealer_id,created_at,status"),
        supabase.from("profiles").select("id,full_name,company,phone").eq("role", "dealer"),
      ]);
      const orderList = (orders as ReminderOrder[]) ?? [];

      let items: ReorderItem[] = [];
      if (orderList.length) {
        const { data } = await supabase
          .from("order_items")
          .select("order_id,product_id,name_he,sku,qty,unit_price")
          .in(
            "order_id",
            orderList.map((o) => o.id)
          );
        items = (data as ReorderItem[]) ?? [];
      }

      setNames(Object.fromEntries(((dealers as DealerLite[]) ?? []).map((d) => [d.id, d])));
      setDue(findReorderDueCustomers(orderList, items));
      setLoading(false);
    })();
  }, []);

  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}${BASE_PATH}/` : "";

  if (loading) return <div className="card h-40 animate-pulse bg-black/5" />;

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-navy-dark">
          זמן לחדש הזמנה
          {due.length > 0 && (
            <span className="mr-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
              {due.length}
            </span>
          )}
        </h3>
        <Link href="/admin/dealers" className="text-sm text-brand hover:underline">
          ללקוחות
        </Link>
      </div>

      {due.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          אף לקוח אינו ממתין לחידוש כרגע 👍
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {due.slice(0, 8).map((c) => {
            const p = names[c.dealerId];
            const link = p?.phone
              ? waMessageLink(
                  p.phone,
                  reorderReminderMessage({
                    name: p.full_name || p.company || undefined,
                    products: c.dueProducts.map((d) => ({
                      name_he: d.name_he,
                      typicalQty: d.typicalQty,
                      avgIntervalDays: d.avgIntervalDays,
                    })),
                    loginUrl,
                  })
                )
              : null;
            const top = c.dueProducts[0];
            return (
              <li key={c.dealerId} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link
                    href={`/admin/customer?id=${c.dealerId}`}
                    className="truncate text-sm font-medium text-navy-dark hover:underline"
                  >
                    {p?.company || p?.full_name || "—"}
                  </Link>
                  <p className="truncate text-xs text-sky-600">
                    {top.name_he}
                    {c.dueProducts.length > 1 ? ` +${c.dueProducts.length - 1}` : ""} · באיחור{" "}
                    {top.daysSinceLast} ימים
                  </p>
                </div>
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg border border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                  >
                    תזכורת חידוש
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
  );
}
