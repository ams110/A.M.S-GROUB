"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile, isAdminRole } from "@/lib/auth";
import { useCart } from "./CartProvider";
import { openCommandPalette } from "./CommandPalette";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

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

// ── Floating pill nav item ───────────────────────────────────────────────────

function PillItem({
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
    <Link href={href} className="flex flex-col items-center gap-1 py-2.5 select-none">
      <span
        className={`relative grid h-9 w-9 place-items-center rounded-full transition-all duration-200 ${
          active
            ? "bg-gold-gradient text-navy-dark shadow-gold"
            : "text-white/55"
        }`}
      >
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-wine px-0.5 text-[10px] font-bold text-white ring-2 ring-[#0C0B0A]">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className={`text-[10px] font-semibold ${active ? "text-gold" : "text-white/45"}`}>
        {label}
      </span>
    </Link>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

export default function Header() {
  const { count } = useCart();
  const { email, profile, ready } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = isAdminRole(profile?.role);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  const navLinkClass = (active: boolean) =>
    `relative text-sm font-medium transition-colors duration-150 px-3 py-1.5 rounded-lg ${
      active
        ? "text-gold bg-white/8"
        : "text-white/65 hover:text-white hover:bg-white/8"
    }`;

  const fourthTab = isAdmin
    ? { href: "/admin", label: "ניהול", active: pathname.startsWith("/admin"), icon: <SettingsIcon /> }
    : email
    ? { href: "/account", label: "חשבון", active: pathname.startsWith("/account"), icon: <UserIcon /> }
    : { href: "/", label: "כניסה", active: pathname === "/", icon: <UserIcon /> };

  const homeHref = email ? "/home" : "/";

  return (
    <>
      {/* ── Top bar ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 glass-onyx print:hidden">
        <div className="container-app flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link href={homeHref} className="flex shrink-0 items-center gap-2.5 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.svg?v=2`}
              alt="A.M.S GROUP"
              className="h-9 w-9 rounded-xl ring-1 ring-gold/40 shadow-sm transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-lg font-extrabold tracking-tight text-white">
              Â.M.Ŝ <span className="text-gradient-gold">GROUP</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/products"
              className={navLinkClass(pathname.startsWith("/products") || pathname.startsWith("/product"))}
            >
              קטלוג
            </Link>
            {email && (
              <Link href="/account/orders" className={navLinkClass(pathname.startsWith("/account"))}>
                ההזמנות שלי
              </Link>
            )}
            {email && (
              <Link href="/account/quotes" className={navLinkClass(pathname === "/account/quotes")}>
                הצעות מחיר
              </Link>
            )}
            {email && (
              <Link
                href="/account"
                className={navLinkClass(pathname === "/account")}
                title="האזור האישי — חשבון ואבטחה"
              >
                חשבון
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className={navLinkClass(pathname.startsWith("/admin"))}>
                ניהול
              </Link>
            )}
          </nav>

          {/* Desktop actions */}
          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={openCommandPalette}
              title="חיפוש מהיר (⌘K)"
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-sm font-medium text-white/70 transition-all hover:border-gold/40 hover:text-white"
            >
              <SearchIcon />
              <kbd className="rounded border border-white/20 px-1 text-[10px] text-white/50">⌘K</kbd>
            </button>
            <Link href="/cart" className="relative rounded-xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition-all hover:border-gold/40 hover:bg-white/12">
              עגלה
              {count > 0 && (
                <span className="absolute -top-2 -left-2 grid h-5 min-w-5 place-items-center rounded-full bg-gold-gradient px-1 text-xs font-bold text-navy-dark">
                  {count}
                </span>
              )}
            </Link>
            {ready && (
              email ? (
                <button
                  onClick={signOut}
                  className="rounded-xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white/75 transition-all hover:bg-white/12 hover:text-white"
                >
                  יציאה
                </button>
              ) : (
                <Link href="/" className="btn-gold">כניסת סוחרים</Link>
              )
            )}
          </div>

          {/* Mobile: search + sign-out / login in top bar */}
          <div className="flex items-center gap-2 md:hidden">
            {email && (
              <button
                onClick={openCommandPalette}
                aria-label="חיפוש"
                className="rounded-lg border border-white/15 bg-white/8 p-1.5 text-white/70"
              >
                <SearchIcon />
              </button>
            )}
            {ready && (
              email ? (
                <button
                  onClick={signOut}
                  className="rounded-lg border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/75"
                >
                  יציאה
                </button>
              ) : (
                <Link href="/" className="rounded-lg bg-gold-gradient px-3 py-1.5 text-xs font-bold text-navy-dark">
                  כניסה
                </Link>
              )
            )}
          </div>
        </div>
        <div className="h-px w-full hairline-gold" />
      </header>

      {/* ── Mobile floating pill nav ───────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 px-4 md:hidden print:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.7rem)" }}
      >
        <div className="mx-auto max-w-sm overflow-hidden rounded-full border border-white/10 ring-1 ring-gold/15 shadow-pill glass-onyx">
          <div className="grid grid-cols-4">
            <PillItem
              href={homeHref}
              label="ראשי"
              active={email ? pathname === "/home" : pathname === "/"}
              icon={<HomeIcon />}
            />
            <PillItem
              href="/products"
              label="קטלוג"
              active={pathname.startsWith("/products") || pathname.startsWith("/product")}
              icon={<GridIcon />}
            />
            <PillItem
              href="/cart"
              label="עגלה"
              active={pathname === "/cart"}
              icon={<CartIcon />}
              badge={count}
            />
            <PillItem {...fourthTab} />
          </div>
        </div>
      </nav>
    </>
  );
}
