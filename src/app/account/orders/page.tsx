"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import {
  formatPrice,
  ORDER_STATUS_HE,
  PAYMENT_STATUS_HE,
  PROFILE_STATUS_HE,
} from "@/lib/format";
import type { Order } from "@/lib/types";

export default function MyOrdersPage() {
  const router = useRouter();
  const { profile, ready, userId } = useProfile();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect guests to login (RLS already blocks data; this is UX only).
  useEffect(() => {
    if (ready && !userId) {
      router.replace("/login?redirect=/account/orders");
    }
  }, [ready, userId, router]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    })();
  }, [userId]);

  const list = orders;

  return (
    <div className="container-app py-10">
      <h1 className="mb-2 text-2xl font-bold">ההזמנות שלי</h1>
      {profile && profile.status !== "approved" && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          סטטוס חשבון: <strong>{PROFILE_STATUS_HE[profile.status]}</strong>. ניתן יהיה
          לבצע הזמנות לאחר אישור היבואן.
        </p>
      )}

      {loading ? (
        <div className="card p-10 text-center text-slate-500">טוען…</div>
      ) : list.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          עדיין אין הזמנות.{" "}
          <Link href="/products" className="font-semibold text-brand hover:underline">
            למעבר לקטלוג
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="p-3">מספר</th>
                <th className="p-3">תאריך</th>
                <th className="p-3">סטטוס</th>
                <th className="p-3">תשלום</th>
                <th className="p-3">סכום</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="border-b border-slate-100">
                  <td className="p-3 font-mono">{o.order_number}</td>
                  <td className="p-3">
                    {new Date(o.created_at).toLocaleDateString("he-IL")}
                  </td>
                  <td className="p-3">
                    <span className="badge bg-slate-100 text-slate-700">
                      {ORDER_STATUS_HE[o.status]}
                    </span>
                  </td>
                  <td className="p-3">{PAYMENT_STATUS_HE[o.payment_status]}</td>
                  <td className="p-3 font-bold text-brand-dark">
                    {formatPrice(o.total, o.currency)}
                  </td>
                  <td className="p-3">
                    <Link href={`/account/order?id=${o.id}`} className="text-brand hover:underline">
                      פרטים
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
