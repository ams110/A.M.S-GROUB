import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

async function count(table: string, filter?: (q: any) => any) {
  const supabase = await createClient();
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [pendingDealers, pendingOrders, totalOrders] = await Promise.all([
    count("tiandy_il_profiles", (q) => q.eq("status", "pending")),
    count("tiandy_il_orders", (q) => q.eq("status", "pending")),
    count("tiandy_il_orders"),
  ]);

  const { data: revenueRows } = await supabase
    .from("tiandy_il_orders")
    .select("total")
    .eq("payment_status", "paid");
  const revenue = (revenueRows ?? []).reduce((s, r) => s + Number(r.total), 0);

  const cards = [
    { label: "סוחרים לאישור", value: pendingDealers, href: "/admin/dealers" },
    { label: "הזמנות ממתינות", value: pendingOrders, href: "/admin/orders" },
    { label: "סה״כ הזמנות", value: totalOrders, href: "/admin/orders" },
    { label: "הכנסות (ששולמו)", value: formatPrice(revenue), href: "/admin/orders" },
  ];

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
