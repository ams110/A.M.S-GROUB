"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, ORDER_STATUS_HE } from "@/lib/format";
import type { Order, Product } from "@/lib/types";

type Stat = {
  label: string;
  value: string | number;
  href: string;
  accent: string; // tailwind text color for the value
  hint?: string;
};

const QUICK_ACTIONS = [
  { href: "/admin/products/edit", label: "מוצר חדש", icon: "➕" },
  { href: "/admin/orders", label: "ניהול הזמנות", icon: "📦" },
  { href: "/admin/quotes", label: "הצעות מחיר", icon: "📝" },
  { href: "/admin/dealers", label: "לקוחות", icon: "👥" },
  { href: "/admin/inventory", label: "מלאי", icon: "🏷️" },
  { href: "/admin/purchase-orders", label: "הזמנת רכש", icon: "🚚" },
  { href: "/admin/settings", label: "הגדרות", icon: "⚙️" },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const count = async (table: string, filter?: (q: any) => any) => {
      let q = supabase.from(table).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count } = await q;
      return count ?? 0;
    };

    (async () => {
      const [
        pendingDealers,
        pendingOrders,
        totalOrders,
        revenueRes,
        recentRes,
        productsRes,
      ] = await Promise.all([
        count("profiles", (q) => q.eq("status", "pending")),
        count("orders", (q) => q.eq("status", "pending")),
        count("orders"),
        supabase.from("orders").select("total").eq("payment_status", "paid"),
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("products").select("*").is("deleted_at", null),
      ]);

      const revenue = (revenueRes.data ?? []).reduce(
        (s, r) => s + Number(r.total),
        0
      );

      const products = (productsRes.data as Product[]) ?? [];
      const low = products.filter(
        (p) => p.reorder_point > 0 && p.stock <= p.reorder_point
      );

      setStats([
        {
          label: "סוחרים לאישור",
          value: pendingDealers,
          href: "/admin/dealers",
          accent: pendingDealers > 0 ? "text-amber-600" : "text-brand-dark",
          hint: pendingDealers > 0 ? "ממתינים לטיפול" : "אין ממתינים",
        },
        {
          label: "הזמנות ממתינות",
          value: pendingOrders,
          href: "/admin/orders",
          accent: pendingOrders > 0 ? "text-amber-600" : "text-brand-dark",
          hint: pendingOrders > 0 ? "ממתינות לאישור" : "הכל מטופל",
        },
        {
          label: "סה״כ הזמנות",
          value: totalOrders,
          href: "/admin/orders",
          accent: "text-brand-dark",
        },
        {
          label: "הכנסות (ששולמו)",
          value: formatPrice(revenue),
          href: "/admin/orders",
          accent: "text-emerald-600",
        },
      ]);
      setRecentOrders((recentRes.data as Order[]) ?? []);
      setLowStock(low);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-slate-500">טוען…</p>;

  return (
    <div className="space-y-8">
      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="card p-5 transition hover:shadow-md"
          >
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className={`mt-2 text-2xl font-bold ${c.accent}`}>{c.value}</p>
            {c.hint && (
              <p className="mt-1 text-xs text-slate-400">{c.hint}</p>
            )}
          </Link>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          פעולות מהירות
        </h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="card flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:shadow-md hover:text-navy"
            >
              <span aria-hidden>{a.icon}</span>
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Recent orders ── */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">הזמנות אחרונות</h2>
            <Link href="/admin/orders" className="text-sm text-brand hover:underline">
              לכל ההזמנות
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">אין הזמנות עדיין.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/account/order?id=${o.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-70"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-slate-500">
                        {o.order_number}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(o.created_at).toLocaleDateString("he-IL")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {ORDER_STATUS_HE[o.status] ?? o.status}
                      </span>
                      <span className="font-bold text-brand-dark">
                        {formatPrice(o.total, o.currency)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Low stock alerts ── */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">
              מלאי נמוך
              {lowStock.length > 0 && (
                <span className="mr-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  {lowStock.length}
                </span>
              )}
            </h2>
            <Link href="/admin/inventory" className="text-sm text-brand hover:underline">
              לניהול מלאי
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              כל המוצרים מעל נקודת ההזמנה. 👍
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStock.slice(0, 6).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <p className="min-w-0 truncate text-sm text-slate-700">
                    {p.name_he}
                  </p>
                  <span className="shrink-0 text-sm font-semibold text-rose-600">
                    {p.stock} / {p.reorder_point}
                  </span>
                </li>
              ))}
              {lowStock.length > 6 && (
                <li className="pt-2 text-center text-xs text-slate-400">
                  ועוד {lowStock.length - 6} מוצרים…
                </li>
              )}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
