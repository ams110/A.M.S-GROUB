"use client";

import Link from "next/link";
import { useProfile } from "@/lib/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, ready } = useProfile();

  // Wait for the auth check before deciding what to show (avoids a flash of
  // "no access" for admins while the session loads).
  if (!ready) {
    return <div className="container-app py-20 text-center text-slate-500">טוען…</div>;
  }

  if (!profile || profile.role !== "admin") {
    return (
      <div className="container-app py-20 text-center">
        <h1 className="text-2xl font-bold">אין הרשאה</h1>
        <p className="mt-2 text-slate-500">אזור זה מיועד למנהלי המערכת בלבד.</p>
        <Link href="/" className="btn-primary mt-6 inline-flex">
          חזרה
        </Link>
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <h1 className="mb-3 text-xl font-bold">ניהול</h1>
        <nav className="flex gap-1 overflow-x-auto text-sm" style={{ scrollbarWidth: "none" }}>
          {[
            { href: "/admin",                  label: "סקירה" },
            { href: "/admin/orders",           label: "הזמנות" },
            { href: "/admin/quotes",           label: "הצעות מחיר" },
            { href: "/admin/dealers",          label: "לקוחות" },
            { href: "/admin/customer-prices",  label: "מחירי לקוח" },
            { href: "/admin/products",         label: "מוצרים" },
            { href: "/admin/categories",       label: "קטגוריות" },
            { href: "/admin/inventory",        label: "מלאי" },
            { href: "/admin/suppliers",        label: "ספקים" },
            { href: "/admin/purchase-orders",  label: "הזמנות רכש" },
            { href: "/admin/settings",         label: "הגדרות" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 rounded-lg px-3 py-1.5 hover:bg-slate-100 whitespace-nowrap"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
