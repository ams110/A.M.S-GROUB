"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  formatPrice,
  ORDER_STATUS_HE,
  PAYMENT_METHOD_HE,
  PAYMENT_STATUS_HE,
} from "@/lib/format";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";

const STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
];
const PAY_STATUSES: PaymentStatus[] = ["unpaid", "paid", "refunded"];

export default function AdminOrdersPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Order[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = async (id: string, patch: Partial<Order>) => {
    setRows((r) => r.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    await supabase.from("orders").update(patch).eq("id", id);
  };

  if (loading) return <p className="text-slate-500">טוען…</p>;

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">הזמנות</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-3">מספר</th>
              <th className="p-3">תאריך</th>
              <th className="p-3">סכום</th>
              <th className="p-3">אמצעי</th>
              <th className="p-3">סטטוס הזמנה</th>
              <th className="p-3">סטטוס תשלום</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-b border-slate-100">
                <td className="p-3 font-mono">{o.order_number}</td>
                <td className="p-3">
                  {new Date(o.created_at).toLocaleDateString("he-IL")}
                </td>
                <td className="p-3 font-bold text-brand-dark">
                  {formatPrice(o.total, o.currency)}
                </td>
                <td className="p-3">{PAYMENT_METHOD_HE[o.payment_method]}</td>
                <td className="p-3">
                  <select
                    value={o.status}
                    onChange={(e) =>
                      update(o.id, { status: e.target.value as OrderStatus })
                    }
                    className="input py-1"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ORDER_STATUS_HE[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <select
                    value={o.payment_status}
                    onChange={(e) =>
                      update(o.id, {
                        payment_status: e.target.value as PaymentStatus,
                      })
                    }
                    className="input py-1"
                  >
                    {PAY_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {PAYMENT_STATUS_HE[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <Link
                    href={`/account/orders/${o.id}`}
                    className="text-brand hover:underline"
                  >
                    פרטים
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  אין הזמנות עדיין.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
