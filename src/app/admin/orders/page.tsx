"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import {
  formatPrice,
  ORDER_STATUS_HE,
  PAYMENT_METHOD_HE,
  PAYMENT_STATUS_HE,
} from "@/lib/format";
import type { Order, OrderStatus, PaymentStatus, Profile } from "@/lib/types";

const STATUSES: OrderStatus[] = [
  "pending", "confirmed", "paid", "shipped", "delivered", "cancelled",
];
const PAY_STATUSES: PaymentStatus[] = ["unpaid", "paid", "refunded"];
const PAGE_SIZE = 25;

export default function AdminOrdersPage() {
  const supabase = createClient();
  const toast = useToast();
  const [rows, setRows] = useState<Order[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "">("");
  const [filterPay, setFilterPay] = useState<PaymentStatus | "">("");
  const [search, setSearch] = useState("");

  const load = async () => {
    const [{ data }, { data: profs }] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,company"),
    ]);
    setRows((data as Order[]) ?? []);
    setNames(
      Object.fromEntries(
        ((profs as Pick<Profile, "id" | "full_name" | "company">[]) ?? []).map((p) => [
          p.id,
          p.company || p.full_name || "—",
        ])
      )
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Who placed the order: the dealer's company/name, falling back to the
  // shipping name captured on the order itself.
  const customerOf = (o: Order) => names[o.dealer_id] || o.ship_name || "—";

  const update = async (id: string, patch: Partial<Order>) => {
    setRows((r) => r.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) {
      toast("שגיאה בעדכון הסטטוס", "error");
    } else {
      toast("הסטטוס עודכן");
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((o) => {
    if (filterStatus && o.status !== filterStatus) return false;
    if (filterPay && o.payment_status !== filterPay) return false;
    if (q) {
      const hay = `${o.order_number} ${customerOf(o)} ${o.ship_name ?? ""} ${o.ship_phone ?? ""} ${o.po_number ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const page_rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) return <p className="text-slate-500">טוען…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">הזמנות</h2>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="חיפוש לפי לקוח, מס׳ הזמנה או טלפון…"
            className="input min-w-[200px] flex-1 sm:max-w-xs"
          />
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as OrderStatus | ""); setPage(0); }}
            className="input w-auto"
          >
            <option value="">כל הסטטוסים</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{ORDER_STATUS_HE[s]}</option>
            ))}
          </select>
          <select
            value={filterPay}
            onChange={(e) => { setFilterPay(e.target.value as PaymentStatus | ""); setPage(0); }}
            className="input w-auto"
          >
            <option value="">כל התשלומים</option>
            {PAY_STATUSES.map((s) => (
              <option key={s} value={s}>{PAYMENT_STATUS_HE[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-500">
        {filtered.length} הזמנות{filterStatus ? ` — ${ORDER_STATUS_HE[filterStatus]}` : ""}
      </p>

      {/* ── Desktop table ── */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-3">מספר</th>
              <th className="p-3">לקוח</th>
              <th className="p-3">תאריך</th>
              <th className="p-3">סכום</th>
              <th className="p-3">אמצעי</th>
              <th className="p-3">סטטוס הזמנה</th>
              <th className="p-3">סטטוס תשלום</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {page_rows.map((o) => (
              <tr key={o.id} className="border-b border-slate-100">
                <td className="p-3 font-mono text-xs">{o.order_number}</td>
                <td className="p-3 font-medium text-navy-dark">{customerOf(o)}</td>
                <td className="p-3">{new Date(o.created_at).toLocaleDateString("he-IL")}</td>
                <td className="p-3 font-bold text-brand-dark">{formatPrice(o.total, o.currency)}</td>
                <td className="p-3">{PAYMENT_METHOD_HE[o.payment_method]}</td>
                <td className="p-3">
                  <select
                    value={o.status}
                    onChange={(e) => update(o.id, { status: e.target.value as OrderStatus })}
                    className="input py-1"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_HE[s]}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <select
                    value={o.payment_status}
                    onChange={(e) => update(o.id, { payment_status: e.target.value as PaymentStatus })}
                    className="input py-1"
                  >
                    {PAY_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_HE[s]}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex gap-3">
                    <Link href={`/account/order?id=${o.id}`} className="text-brand hover:underline">פרטים</Link>
                    <Link href={`/invoice?order=${o.id}`} className="text-brand hover:underline">חשבונית</Link>
                  </div>
                </td>
              </tr>
            ))}
            {page_rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">אין הזמנות.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ── */}
      <div className="space-y-3 md:hidden">
        {page_rows.length === 0 && (
          <p className="py-10 text-center text-slate-400">אין הזמנות.</p>
        )}
        {page_rows.map((o) => (
          <div key={o.id} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy-dark">{customerOf(o)}</p>
                <span className="font-mono text-xs text-slate-500">{o.order_number}</span>
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {new Date(o.created_at).toLocaleDateString("he-IL")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-brand-dark text-base">{formatPrice(o.total, o.currency)}</span>
              <span className="text-sm text-slate-500">{PAYMENT_METHOD_HE[o.payment_method]}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-xs text-slate-400">סטטוס הזמנה</p>
                <select
                  value={o.status}
                  onChange={(e) => update(o.id, { status: e.target.value as OrderStatus })}
                  className="input py-1.5 text-xs w-full"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_HE[s]}</option>)}
                </select>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-400">סטטוס תשלום</p>
                <select
                  value={o.payment_status}
                  onChange={(e) => update(o.id, { payment_status: e.target.value as PaymentStatus })}
                  className="input py-1.5 text-xs w-full"
                >
                  {PAY_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_HE[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 border-t border-slate-100 pt-2">
              <Link href={`/account/order?id=${o.id}`} className="text-sm text-brand hover:underline">פרטים</Link>
              <Link href={`/invoice?order=${o.id}`} className="text-sm text-brand hover:underline">חשבונית</Link>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-outline px-4"
          >
            ‹ הקודם
          </button>
          <span className="text-sm text-slate-600">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="btn-outline px-4"
          >
            הבא ›
          </button>
        </div>
      )}
    </div>
  );
}
