"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile, isAdminRole } from "@/lib/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, ready, isSuperAdmin } = useProfile();
  const pathname = usePathname();

  if (!ready) {
    return <div className="container-app py-20 text-center text-slate-500">טוען…</div>;
  }

  if (!profile || !isAdminRole(profile.role)) {
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

  const navLinks = [
    { href: "/admin",                  label: "סקירה",        exact: true },
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
    ...(isSuperAdmin ? [{ href: "/admin/admins", label: "🔑 מנהלים" }] : []),
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="container-app py-8">
      <div className="mb-6 border-b border-navy/10 pb-4">
        <div className="mb-3 flex items-center gap-3">
          <h1 className="text-xl font-bold text-navy-dark">
            לוח <span className="text-gradient-gold">ניהול</span>
          </h1>
          {isSuperAdmin && (
            <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold-dark">
              מנהל ראשי
            </span>
          )}
        </div>
        <nav className="-mx-1 flex flex-wrap gap-1.5 px-1">
          {navLinks.map(({ href, label, exact }) => (
            <Link
              key={href}
              href={href}
              className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                isActive(href, exact)
                  ? "bg-gold-gradient text-navy-dark shadow-gold"
                  : "bg-white text-slate-600 ring-1 ring-navy/10 hover:bg-gold-50 hover:text-navy hover:ring-gold/30"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="animate-fade-in">
        {children}
      </div>
    </div>
  );
}
