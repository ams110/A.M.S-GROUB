"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/CartProvider";
import { formatPrice, PAYMENT_METHOD_HE } from "@/lib/format";
import type { PaymentMethod, Profile } from "@/lib/types";

export default function CheckoutPage() {
  const { lines, subtotal, count, clear } = useCart();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [outstanding, setOutstanding] = useState(0);
  const [minOrder, setMinOrder] = useState(0);
  const [form, setForm] = useState({
    ship_name: "",
    ship_phone: "",
    ship_city: "",
    ship_address: "",
    notes: "",
    po_number: "",
  });

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/checkout");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      const p = data as Profile | null;
      setProfile(p);
      if (p) {
        setForm((f) => ({
          ...f,
          ship_name: p.full_name ?? "",
          ship_phone: p.phone ?? "",
          ship_city: p.city ?? "",
          ship_address: p.address ?? "",
        }));
      }

      // Current outstanding balance (sum of this customer's unpaid orders).
      const [{ data: orders }, { data: settings }] = await Promise.all([
        supabase.from("orders").select("total,payment_status"),
        supabase.from("settings").select("key,value").in("key", ["min_order_value"]),
      ]);
      setOutstanding(
        ((orders ?? []) as { total: number; payment_status: string }[])
          .filter((o) => o.payment_status !== "paid")
          .reduce((s, o) => s + Number(o.total), 0)
      );
      const min = Number(settings?.find((s) => s.key === "min_order_value")?.value || 0);
      setMinOrder(Number.isFinite(min) ? min : 0);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ERROR_HE: Record<string, string> = {
    DEALER_NOT_APPROVED: "החשבון עדיין ממתין לאישור היבואן.",
    EMPTY_CART: "העגלה ריקה.",
    AUTH_REQUIRED: "נדרשת התחברות.",
  };

  const placeOrder = async () => {
    setError(null);
    if (!form.ship_name || !form.ship_phone || !form.ship_address) {
      setError("נא למלא שם, טלפון וכתובת למשלוח.");
      return;
    }
    if (minOrder > 0 && subtotal < minOrder) {
      setError(`סכום הזמנה מינימלי הוא ${formatPrice(minOrder)}.`);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("place_order", {
      p_items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })),
      p_payment_method: method,
      p_ship_name: form.ship_name,
      p_ship_phone: form.ship_phone,
      p_ship_city: form.ship_city,
      p_ship_address: form.ship_address,
      p_notes: form.notes || null,
      p_po_number: form.po_number || null,
    });
    setSubmitting(false);

    if (error) {
      const code = error.message.split(":")[0].trim();
      setError(ERROR_HE[code] ?? `שגיאה בביצוע ההזמנה: ${error.message}`);
      return;
    }
    clear();
    router.push(`/account/order?id=${data.id}&new=1`);
  };

  if (loading) {
    return <div className="container-app py-16 text-center text-slate-500">טוען…</div>;
  }

  if (count === 0) {
    return (
      <div className="container-app py-16 text-center">
        <h1 className="text-xl font-bold">העגלה ריקה</h1>
        <Link href="/products" className="btn-primary mt-6 inline-flex">לקטלוג</Link>
      </div>
    );
  }

  const notApproved = !profile || profile.status !== "approved";

  return (
    <div className="container-app py-10">
      <p className="eyebrow mb-1.5">השלב האחרון</p>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-navy-dark">סיום הזמנה ותשלום</h1>

      {notApproved && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-4 text-sm text-amber-800">
          <strong>החשבון ממתין לאישור.</strong> לאחר שהיבואן יאשר את חשבון הסוחר
          תוכלו לבצע הזמנות. סטטוס נוכחי: {profile?.status ?? "—"}.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Shipping */}
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-bold">פרטי משלוח</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">שם מלא / עסק *</label>
                <input
                  className="input"
                  value={form.ship_name}
                  onChange={(e) => setForm({ ...form, ship_name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">טלפון *</label>
                <input
                  className="input"
                  value={form.ship_phone}
                  onChange={(e) => setForm({ ...form, ship_phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">עיר</label>
                <input
                  className="input"
                  value={form.ship_city}
                  onChange={(e) => setForm({ ...form, ship_city: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">כתובת מלאה *</label>
                <input
                  className="input"
                  value={form.ship_address}
                  onChange={(e) => setForm({ ...form, ship_address: e.target.value })}
                />
              </div>
              <div>
                <label className="label">מספר הזמנת רכש (PO)</label>
                <input
                  className="input"
                  placeholder="לשימושכם הפנימי"
                  value={form.po_number}
                  onChange={(e) => setForm({ ...form, po_number: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">הערות להזמנה</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-bold">אמצעי תשלום</h2>
            <div className="space-y-3">
              {(["card", "bank_transfer", "cod"] as PaymentMethod[]).map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                    method === m ? "border-brand bg-brand-light" : "border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="method"
                    checked={method === m}
                    onChange={() => setMethod(m)}
                  />
                  <span className="font-medium">{PAYMENT_METHOD_HE[m]}</span>
                </label>
              ))}
            </div>
            {method === "bank_transfer" && (
              <p className="mt-3 rounded bg-slate-50 p-3 text-xs text-slate-600">
                לאחר ביצוע ההזמנה יוצגו פרטי החשבון להעברה. ההזמנה תאושר עם קבלת התשלום.
              </p>
            )}
            {method === "card" && (
              <p className="mt-3 rounded bg-slate-50 p-3 text-xs text-slate-600">
                תשלום בכרטיס אשראי — נציג ייצור איתכם קשר להשלמת הסליקה. ההזמנה תיווצר
                במצב “ממתין לתשלום”.
              </p>
            )}
            {method === "cod" && (
              <p className="mt-3 rounded bg-slate-50 p-3 text-xs text-slate-600">
                תשלום במזומן בעת מסירת הסחורה.
              </p>
            )}
          </section>
        </div>

        {/* Summary */}
        <aside className="card h-fit space-y-4 p-5">
          <h2 className="text-lg font-bold">סיכום</h2>
          <div className="max-h-60 space-y-2 overflow-auto">
            {lines.map((l) => (
              <div key={l.product_id} className="flex justify-between text-sm">
                <span className="line-clamp-1">
                  {l.name_he} × {l.qty}
                </span>
                <span className="font-medium">{formatPrice(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-3 text-lg font-bold">
            <span>סה״כ</span>
            <span className="text-brand-dark">{formatPrice(subtotal)}</span>
          </div>

          {profile && profile.credit_limit > 0 && (
            <div
              className={`rounded-lg px-3 py-2 text-xs ${
                outstanding + subtotal > profile.credit_limit
                  ? "bg-rose-50 text-rose-700"
                  : "bg-slate-50 text-slate-600"
              }`}
            >
              חוב נוכחי: {formatPrice(outstanding)} · מסגרת אשראי:{" "}
              {formatPrice(profile.credit_limit)}
              {outstanding + subtotal > profile.credit_limit && (
                <div className="mt-1 font-bold">
                  ⚠ ההזמנה חורגת ממסגרת האשראי. ייתכן שתידרש אישור היבואן.
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}

          <button
            onClick={placeOrder}
            disabled={submitting || notApproved}
            className="btn-primary w-full"
          >
            {submitting ? "מבצע הזמנה…" : "אישור וביצוע הזמנה"}
          </button>
        </aside>
      </div>
    </div>
  );
}
