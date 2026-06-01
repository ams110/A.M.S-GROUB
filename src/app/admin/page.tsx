"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/format";

export default function AdminDashboard() {
  const [cards, setCards] = useState<{ label: string; value: string | number; href: string }[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const count = async (table: string, filter?: (q: any) => any) => {
      let q = supabase.from(table).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count } = await q;
      return count ?? 0;
    };

    (async () => {
      const [pendingDealers, pendingOrders, totalOrders] = await Promise.all([
        count("profiles", (q) => q.eq("status", "pending")),
        count("orders", (q) => q.eq("status", "pending")),
        count("orders"),
      ]);

      const { data: revenueRows } = await supabase
        .from("orders")
        .select("total")
        .eq("payment_status", "paid");
      const revenue = (revenueRows ?? []).reduce((s, r) => s + Number(r.total), 0);

      setCards([
        { label: "סוחרים לאישור", value: pendingDealers, href: "/admin/dealers" },
        { label: "הזמנות ממתינות", value: pendingOrders, href: "/admin/orders" },
        { label: "סה״כ הזמנות", value: totalOrders, href: "/admin/orders" },
        { label: "הכנסות (ששולמו)", value: formatPrice(revenue), href: "/admin/orders" },
      ]);
    })();
  }, []);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card p-5 transition hover:shadow-md">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-2 text-2xl font-bold text-brand-dark">{c.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
