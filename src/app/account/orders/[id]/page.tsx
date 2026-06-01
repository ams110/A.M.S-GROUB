import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formatPrice,
  ORDER_STATUS_HE,
  PAYMENT_METHOD_HE,
  PAYMENT_STATUS_HE,
} from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("tiandy_il_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (!order) notFound();
  const o = order as Order;

  const { data: items } = await supabase
    .from("tiandy_il_order_items")
    .select("*")
    .eq("order_id", id);

  const lines = (items as OrderItem[] | null) ?? [];

  const { data: settings } = await supabase
    .from("tiandy_il_settings")
    .select("key,value")
    .in("key", ["bank_details"]);
  const bank = settings?.find((s) => s.key === "bank_details")?.value;

  return (
    <div className="container-app max-w-3xl py-10">
      <Link href="/account/orders" className="text-sm text-brand hover:underline">
        ← לכל ההזמנות
      </Link>

      {isNew && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          <strong>ההזמנה התקבלה!</strong> מספר הזמנה: {o.order_number}. נטפל בה בהקדם.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">הזמנה {o.order_number}</h1>
        <span className="badge bg-brand-light text-brand-dark">
          {ORDER_STATUS_HE[o.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {new Date(o.created_at).toLocaleString("he-IL")}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-4 text-sm">
          <h2 className="mb-2 font-bold">פרטי משלוח</h2>
          <p>{o.ship_name}</p>
          <p>{o.ship_phone}</p>
          <p>
            {o.ship_address}
            {o.ship_city ? `, ${o.ship_city}` : ""}
          </p>
          {o.notes && <p className="mt-2 text-slate-500">הערה: {o.notes}</p>}
        </div>
        <div className="card p-4 text-sm">
          <h2 className="mb-2 font-bold">תשלום</h2>
          <p>אמצעי: {PAYMENT_METHOD_HE[o.payment_method]}</p>
          <p>סטטוס תשלום: {PAYMENT_STATUS_HE[o.payment_status]}</p>
          {o.payment_method === "bank_transfer" && o.payment_status === "unpaid" && (
            <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">
              {bank ?? "להעברה בנקאית — פרטי החשבון יישלחו אליכם בנפרד."}
            </p>
          )}
        </div>
      </div>

      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-3">מוצר</th>
              <th className="p-3">מחיר יח׳</th>
              <th className="p-3">כמות</th>
              <th className="p-3">סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="p-3">
                  {l.name_he}
                  {l.sku && <span className="text-slate-400"> · {l.sku}</span>}
                </td>
                <td className="p-3">{formatPrice(l.unit_price, o.currency)}</td>
                <td className="p-3">{l.qty}</td>
                <td className="p-3 font-medium">{formatPrice(l.line_total, o.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-lg font-bold">
              <td className="p-3" colSpan={3}>
                סה״כ
              </td>
              <td className="p-3 text-brand-dark">{formatPrice(o.total, o.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
