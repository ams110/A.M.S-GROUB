"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";

type Section = {
  href: string;
  label: string;
  desc: string;
  icon: string;
  badge?: number;
  superOnly?: boolean;
};

export default function AdminHub() {
  const { isSuperAdmin } = useProfile();
  const [counts, setCounts] = useState({ pendingOrders: 0, pendingDealers: 0, lowStock: 0 });

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const count = async (table: string, filter?: (q: any) => any) => {
        let q = supabase.from(table).select("*", { count: "exact", head: true });
        if (filter) q = filter(q);
        const { count } = await q;
        return count ?? 0;
      };
      const [pendingOrders, pendingDealers, products] = await Promise.all([
        count("orders", (q) => q.eq("status", "pending")),
        count("profiles", (q) => q.eq("status", "pending")),
        supabase.from("products").select("stock,reorder_point").is("deleted_at", null),
      ]);
      const lowStock = ((products.data as any[]) ?? []).filter(
        (p) => p.reorder_point > 0 && p.stock <= p.reorder_point
      ).length;
      setCounts({ pendingOrders, pendingDealers, lowStock });
    })();
  }, []);

  const sections: Section[] = [
    { href: "/admin/orders", label: "הזמנות", desc: "אישור, מעקב וניהול הזמנות", icon: "📦", badge: counts.pendingOrders },
    { href: "/admin/quotes", label: "הצעות מחיר", desc: "יצירה וניהול הצעות", icon: "📝" },
    { href: "/admin/dealers", label: "לקוחות", desc: "סוחרים, אישורים והרשאות", icon: "👥", badge: counts.pendingDealers },
    { href: "/admin/customer-prices", label: "מחירי לקוח", desc: "תמחור מותאם אישית", icon: "🏷️" },
    { href: "/admin/products", label: "מוצרים", desc: "קטלוג, מחירים ותמונות", icon: "📷" },
    { href: "/admin/categories", label: "קטגוריות", desc: "ארגון הקטלוג", icon: "🗂️" },
    { href: "/admin/inventory", label: "מלאי", desc: "כמויות ותנועות מלאי", icon: "📊", badge: counts.lowStock },
    { href: "/admin/suppliers", label: "ספקים", desc: "ניהול ספקים", icon: "🤝" },
    { href: "/admin/purchase-orders", label: "הזמנות רכש", desc: "רכש וקליטת סחורה", icon: "🚚" },
    { href: "/admin/settings", label: "הגדרות", desc: "באנר, תשלום ופרטי עסק", icon: "⚙️" },
    { href: "/admin/admins", label: "מנהלים", desc: "ניהול הרשאות מנהלים", icon: "🔑", superOnly: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">מרכז הניהול</p>
        <h2 className="text-2xl font-extrabold tracking-tight text-navy-dark">כל הכלים במקום אחד</h2>
        <p className="mt-1 text-sm text-slate-500">
          לסקירה החיה והנתונים — עברו ל
          <Link href="/home" className="font-semibold text-brand hover:underline">דף הבית</Link>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections
          .filter((s) => !s.superOnly || isSuperAdmin)
          .map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="card card-hover group relative flex items-center gap-4 p-5"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-50 text-2xl ring-1 ring-gold/20">
                {s.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-navy-dark">{s.label}</h3>
                  {s.badge ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                      {s.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">{s.desc}</p>
              </div>
              <span className="text-slate-300 transition group-hover:text-gold">←</span>
            </Link>
          ))}
      </div>
    </div>
  );
}
