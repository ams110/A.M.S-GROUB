"use client";

/**
 * Daily Briefing — the admin's morning checklist on the management home.
 *
 * Pulls the same raw data the Operations Center uses, but answers the sharper
 * question "what do I need to *do* today?" via the pure `buildBriefing` engine:
 * orders to approve, money overdue, stock running out, quotes going stale,
 * customers drifting away — each a tappable row that deep-links to the screen
 * where you act on it. Silent when there's nothing pressing.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { buildBriefing, greeting, type BriefingItem, type Severity } from "@/lib/briefing";

const SEVERITY_STYLE: Record<Severity, string> = {
  urgent: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  attention: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  info: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
};

export default function DailyBriefing() {
  const { profile } = useProfile();
  const [items, setItems] = useState<BriefingItem[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: orders }, { data: dealers }, { data: products }, { data: quotes }] =
        await Promise.all([
          supabase.from("orders").select("id,dealer_id,status,payment_status,total,created_at"),
          supabase.from("profiles").select("id,payment_terms,status").eq("role", "dealer"),
          supabase.from("products").select("reorder_point,stock").is("deleted_at", null),
          supabase.from("quotes").select("status,valid_until"),
        ]);
      setItems(
        buildBriefing({
          orders: (orders as never[]) ?? [],
          dealers: (dealers as never[]) ?? [],
          products: (products as never[]) ?? [],
          quotes: (quotes as never[]) ?? [],
        })
      );
    })();
  }, []);

  const name = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <section className="card border-gold-500/20 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-0.5">נבץ היום</p>
          <h2 className="text-xl font-extrabold text-navy-dark">
            {greeting()}
            {name ? `, ${name}` : ""} 👋
          </h2>
        </div>
        <span aria-hidden className="text-3xl">📋</span>
      </div>

      {items == null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-emerald-500/10 px-4 py-6 text-center text-sm font-medium text-emerald-300">
          הכל רגוע ✨ אין משימות דחופות כרגע.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.key}>
              <Link
                href={it.href}
                className="flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10"
              >
                <span aria-hidden className="text-2xl">{it.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-navy-dark">{it.title}</span>
                  <span className="block truncate text-sm text-slate-400">{it.detail}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-extrabold ring-1 ${SEVERITY_STYLE[it.severity]}`}
                >
                  {it.count}
                </span>
                <span aria-hidden className="text-slate-500">‹</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
