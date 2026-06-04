import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, Product } from "@/lib/types";

export type RangeDays = 7 | 14 | 30;

export type DashboardData = {
  // Financial (super-admin only)
  revenuePaid: number;
  revenuePrev: number;
  grossProfit: number;
  marginPct: number;
  monthlyRevenue: number;
  dailyRevenue: number[];
  dailyLabels: string[];
  // Operational
  ordersInRange: number;
  ordersPrev: number;
  pendingOrders: number;
  pendingDealers: number;
  totalOrders: number;
  lowStock: Product[];
  recentOrders: Order[];
  topProducts: { name: string; qty: number; revenue: number }[];
  topCustomers: { name: string; orders: number; total: number }[];
  funnel: { status: string; count: number }[];
  currency: string;
};

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const FUNNEL_ORDER = ["pending", "confirmed", "paid", "shipped", "delivered"];

export async function loadDashboard(
  supabase: SupabaseClient,
  range: RangeDays
): Promise<DashboardData> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - range * DAY);
  const prevStart = new Date(now.getTime() - 2 * range * DAY);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [ordersRes, pendingDealersRes, totalOrdersRes, productsRes, profilesRes] =
    await Promise.all([
      // All orders from the previous period onward (covers current + previous)
      supabase
        .from("orders")
        .select("id,order_number,status,payment_status,total,currency,created_at,dealer_id")
        .gte("created_at", prevStart.toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*").is("deleted_at", null),
      supabase.from("profiles").select("id,company,full_name"),
    ]);

  const orders = (ordersRes.data as Order[]) ?? [];
  const products = (productsRes.data as Product[]) ?? [];
  const profileMap = new Map<string, string>(
    (profilesRes.data ?? []).map((p: any) => [p.id, p.company || p.full_name || "—"])
  );

  const inCurrent = (o: Order) => new Date(o.created_at) >= periodStart;
  const inPrev = (o: Order) =>
    new Date(o.created_at) >= prevStart && new Date(o.created_at) < periodStart;
  const isPaid = (o: Order) => o.payment_status === "paid";

  const currentOrders = orders.filter(inCurrent);
  const prevOrders = orders.filter(inPrev);

  const sum = (arr: Order[]) => arr.reduce((s, o) => s + Number(o.total || 0), 0);
  const revenuePaid = sum(currentOrders.filter(isPaid));
  const revenuePrev = sum(prevOrders.filter(isPaid));
  const monthlyRevenue = sum(orders.filter((o) => isPaid(o) && new Date(o.created_at) >= monthStart));

  // Daily revenue series (oldest → newest) for current range
  const dailyRevenue: number[] = [];
  const dailyLabels: string[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const day = startOfDay(new Date(now.getTime() - i * DAY));
    const next = new Date(day.getTime() + DAY);
    const total = currentOrders
      .filter((o) => isPaid(o) && new Date(o.created_at) >= day && new Date(o.created_at) < next)
      .reduce((s, o) => s + Number(o.total || 0), 0);
    dailyRevenue.push(total);
    dailyLabels.push(`${day.getDate()}/${day.getMonth() + 1}`);
  }

  // Funnel — current range orders by status
  const funnel = FUNNEL_ORDER.map((status) => ({
    status,
    count: currentOrders.filter((o) => o.status === status).length,
  }));

  // Low stock
  const lowStock = products.filter((p) => p.reorder_point > 0 && p.stock <= p.reorder_point);

  // Top customers (current range, by total)
  const custMap = new Map<string, { orders: number; total: number }>();
  for (const o of currentOrders) {
    const k = o.dealer_id;
    const e = custMap.get(k) ?? { orders: 0, total: 0 };
    e.orders += 1;
    e.total += Number(o.total || 0);
    custMap.set(k, e);
  }
  const topCustomers = [...custMap.entries()]
    .map(([id, v]) => ({ name: profileMap.get(id) ?? "—", ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Top products + gross-profit estimate — need order_items for current orders
  let topProducts: DashboardData["topProducts"] = [];
  let grossProfit = 0;
  let costedRevenue = 0;
  const currentIds = currentOrders.map((o) => o.id);
  if (currentIds.length) {
    const [itemsRes, movesRes] = await Promise.all([
      supabase
        .from("order_items")
        .select("order_id,product_id,name_he,qty,line_total,unit_price")
        .in("order_id", currentIds),
      // Average purchase cost per product (best-effort estimate)
      supabase.from("stock_movements").select("product_id,unit_cost").not("unit_cost", "is", null),
    ]);
    const items = (itemsRes.data as any[]) ?? [];
    const costAgg = new Map<string, { sum: number; n: number }>();
    for (const m of (movesRes.data as any[]) ?? []) {
      if (m.unit_cost == null || !m.product_id) continue;
      const e = costAgg.get(m.product_id) ?? { sum: 0, n: 0 };
      e.sum += Number(m.unit_cost);
      e.n += 1;
      costAgg.set(m.product_id, e);
    }
    const avgCost = (pid: string | null) => {
      if (!pid) return null;
      const e = costAgg.get(pid);
      return e && e.n ? e.sum / e.n : null;
    };

    const prodMap = new Map<string, { name: string; qty: number; revenue: number }>();
    // Only count items belonging to paid orders for revenue/profit
    const paidIds = new Set(currentOrders.filter(isPaid).map((o) => o.id));
    for (const it of items) {
      const key = it.product_id ?? it.name_he;
      const e = prodMap.get(key) ?? { name: it.name_he, qty: 0, revenue: 0 };
      e.qty += Number(it.qty || 0);
      e.revenue += Number(it.line_total || 0);
      prodMap.set(key, e);

      if (paidIds.has(it.order_id)) {
        const c = avgCost(it.product_id);
        if (c != null) {
          const rev = Number(it.unit_price || 0) * Number(it.qty || 0);
          grossProfit += rev - c * Number(it.qty || 0);
          costedRevenue += rev;
        }
      }
    }
    topProducts = [...prodMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }

  const marginPct = costedRevenue > 0 ? (grossProfit / costedRevenue) * 100 : 0;

  return {
    revenuePaid,
    revenuePrev,
    grossProfit,
    marginPct,
    monthlyRevenue,
    dailyRevenue,
    dailyLabels,
    ordersInRange: currentOrders.length,
    ordersPrev: prevOrders.length,
    pendingOrders: currentOrders.filter((o) => o.status === "pending").length,
    pendingDealers: pendingDealersRes.count ?? 0,
    totalOrders: totalOrdersRes.count ?? 0,
    lowStock,
    recentOrders: orders.slice(0, 6),
    topProducts,
    topCustomers,
    funnel,
    currency: orders[0]?.currency ?? "ILS",
  };
}
