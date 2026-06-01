"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/format";

export default function AdminDashboard() {
  const [cards, setCards] = useState<{ label: string; value: string | number; href: string }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const countOf = async (table: string, build?: (q: any) => any) => {
      let q = supabase.from(table).select("*", { count: "exact", head: true });
      if (build) q = build(q);
      const { count } = await q;
      return count ?? 0;
    };
    (async () => {
      const [pendingDealers, pendingOrders, totalOrders, { data: paid }] = await Promise.all([
        countOf("profiles", (q) => q.eq("status", "pending")),
        countOf("orders", (q) => q.eq("status", "pending")),
        countOf("orders"),
        supabase.from("orders").select("total").eq("payment_status", "paid"),
      ]);
      const revenue = (paid ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);
      setCards([
        { label: "סוחרים לאישור", value: pendingDealers, href: "/admin/dealers" },
        { label: "הזמנות ממתינות", value: pendingOrders, href: "/admin/orders" },
        { label: "סה״כ הזמנות", value: totalOrders, href: "/admin/orders" },
        { label: "הכנסות (ששולמו)", value: formatPrice(revenue), href: "/admin/orders" },
      ]);
    })();
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Link key={c.label} href={c.href} className="card p-5 transition hover:shadow-md">
          <p className="text-sm text-slate-500">{c.label}</p>
          <p className="mt-2 text-2xl font-bold text-brand-dark">{c.value}</p>
        </Link>
      ))}
    </div>
  );
}
