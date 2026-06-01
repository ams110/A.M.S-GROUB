"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, CUSTOMER_TYPE_HE } from "@/lib/format";
import type { CustomerPrice, Product, Profile } from "@/lib/types";

function CustomerPrices() {
  const supabase = createClient();
  const customerId = useSearchParams().get("customer") ?? "";

  const [customers, setCustomers] = useState<Profile[]>([]);
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .neq("role", "admin")
        .order("full_name");
      const list = (profs as Profile[]) ?? [];
      setCustomers(list);

      if (customerId) {
        setCustomer(list.find((c) => c.id === customerId) ?? null);
        const [{ data: prods }, { data: cps }] = await Promise.all([
          supabase.from("products").select("*").is("deleted_at", null).order("name_he"),
          supabase.from("customer_prices").select("*").eq("profile_id", customerId),
        ]);
        setProducts((prods as Product[]) ?? []);
        setOverrides(
          Object.fromEntries(
            ((cps as CustomerPrice[]) ?? []).map((c) => [c.product_id, Number(c.price)])
          )
        );
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const isContractor = customer?.customer_type === "contractor";
  const basePrice = (p: Product) =>
    isContractor && p.price_contractor > 0 ? p.price_contractor : p.price;

  const filtered = useMemo(
    () =>
      products.filter((p) =>
        `${p.name_he} ${p.sku ?? ""}`.toLowerCase().includes(q.toLowerCase())
      ),
    [products, q]
  );

  const saveOverride = async (productId: string, raw: string) => {
    setSavingId(productId);
    const value = Number(raw);
    if (!raw || value <= 0) {
      setOverrides((o) => {
        const n = { ...o };
        delete n[productId];
        return n;
      });
      await supabase
        .from("customer_prices")
        .delete()
        .eq("profile_id", customerId)
        .eq("product_id", productId);
    } else {
      setOverrides((o) => ({ ...o, [productId]: value }));
      await supabase
        .from("customer_prices")
        .upsert(
          { profile_id: customerId, product_id: productId, price: value },
          { onConflict: "profile_id,product_id" }
        );
    }
    setSavingId(null);
  };

  if (loading) return <p className="text-slate-500">טוען…</p>;

  // No customer chosen → picker.
  if (!customerId) {
    return (
      <div className="max-w-xl">
        <h2 className="mb-4 text-lg font-bold">מחירים מיוחדים ללקוח</h2>
        <p className="mb-4 text-sm text-slate-500">בחרו לקוח לעריכת מחירים מיוחדים:</p>
        <div className="card divide-y divide-slate-100">
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`/admin/customer-prices?customer=${c.id}`}
              className="flex items-center justify-between p-3 hover:bg-slate-50"
            >
              <span className="font-medium">{c.full_name ?? c.company ?? "—"}</span>
              <span className="badge bg-slate-100 text-slate-600">
                {CUSTOMER_TYPE_HE[c.customer_type]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">
            מחירים מיוחדים — {customer?.full_name ?? customer?.company ?? "לקוח"}
          </h2>
          <p className="text-sm text-slate-500">
            סוג: {customer ? CUSTOMER_TYPE_HE[customer.customer_type] : "—"} · השאירו ריק
            כדי להשתמש במחיר הרגיל.
          </p>
        </div>
        <Link href="/admin/customer-prices" className="text-sm text-brand hover:underline">
          ← לכל הלקוחות
        </Link>
      </div>

      <input
        placeholder="חיפוש מוצר…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="input mb-3 max-w-xs"
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-3">מוצר</th>
              <th className="p-3">מחיר רגיל</th>
              <th className="p-3">מחיר מיוחד</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="p-3">
                  <div className="font-medium">{p.name_he}</div>
                  {p.sku && <div className="text-xs text-slate-400">{p.sku}</div>}
                </td>
                <td className="p-3 text-slate-500">{formatPrice(basePrice(p), p.currency)}</td>
                <td className="p-3">
                  <input
                    type="number"
                    step="0.01"
                    className={`input w-32 py-1 ${
                      overrides[p.id] ? "border-brand" : ""
                    }`}
                    defaultValue={overrides[p.id] ?? ""}
                    placeholder="—"
                    onBlur={(e) => saveOverride(p.id, e.target.value)}
                  />
                  {savingId === p.id && (
                    <span className="mr-2 text-xs text-slate-400">שומר…</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CustomerPricesPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">טוען…</p>}>
      <CustomerPrices />
    </Suspense>
  );
}
