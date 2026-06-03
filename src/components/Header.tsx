"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { useCart } from "./CartProvider";

// ── Icons ────────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

// ── Bottom nav item ──────────────────────────────────────────────────────────

function BottomNavItem({
  href,
  label,
  active,
  icon,
  badge,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
        active ? "text-brand" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      <span className="relative">
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-0.5 text-[10px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span>{label}</span>
    </Link>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

export default function Header() {
  const { count } = useCart();
  const { email, profile, ready } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = profile?.role === "admin";

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  // The 4th slot in the bottom nav changes by role.
  const fourthTab = isAdmin
    ? { href: "/admin", label: "ניהול", active: pathname.startsWith("/admin"), icon: <SettingsIcon /> }
    : email
    ? { href: "/account/orders", label: "הזמנות", active: pathname.startsWith("/account"), icon: <PackageIcon /> }
    : { href: "/login", label: "כניסה", active: pathname === "/login", icon: <UserIcon /> };

  return (
    <>
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="container-app flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.svg`}
              alt="A.M.S GROUP"
              className="h-9 w-9 rounded-lg"
            />
            <span className="text-lg font-bold text-brand-dark">Â.M.Ŝ GROUP</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <Link
              href="/products"
              className={`hover:text-brand ${pathname.startsWith("/products") || pathname.startsWith("/product") ? "text-brand" : ""}`}
            >
              קטלוג
            </Link>
            {email && (
              <Link
                href="/account/orders"
                className={`hover:text-brand ${pathname.startsWith("/account") ? "text-brand" : ""}`}
              >
                ההזמנות שלי
              </Link>
            )}
            {email && (
              <Link href="/account/quotes" className="hover:text-brand">
                הצעות מחיר
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className="font-semibold text-brand">
                ניהול
              </Link>
            )}
          </nav>

          {/* Desktop actions */}
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/cart" className="relative btn-outline">
              עגלה
              {count > 0 && (
                <span className="absolute -top-2 -left-2 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-xs font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
            {ready && (
              email ? (
                <button onClick={signOut} className="btn-outline">יציאה</button>
              ) : (
                <Link href="/login" className="btn-primary">כניסת סוחרים</Link>
              )
            )}
          </div>

          {/* Mobile: sign-out / login shortcut in the top bar */}
          <div className="flex items-center md:hidden">
            {ready && (
              email ? (
                <button onClick={signOut} className="btn-outline text-xs px-3 py-1.5">יציאה</button>
              ) : (
                <Link href="/login" className="btn-primary text-xs px-3 py-1.5">כניסה</Link>
              )
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile bottom nav ──────────────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid h-16 grid-cols-4">
          <BottomNavItem
            href="/"
            label="ראשי"
            active={pathname === "/"}
            icon={<HomeIcon />}
          />
          <BottomNavItem
            href="/products"
            label="קטלוג"
            active={pathname.startsWith("/products") || pathname.startsWith("/product")}
            icon={<GridIcon />}
          />
          <BottomNavItem
            href="/cart"
            label="עגלה"
            active={pathname === "/cart"}
            icon={<CartIcon />}
            badge={count}
          />
          <BottomNavItem {...fourthTab} />
        </div>
      </nav>
    </>
  );
}
