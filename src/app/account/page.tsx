"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProfile, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

// ── Icons ────────────────────────────────────────────────────────────────────
function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 text-slate-300">
      {/* points left for RTL */}
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function PackageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
function QuoteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}
function FingerprintIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────
function MenuRow({ href, icon, title, subtitle }: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 shadow-sm transition-colors hover:bg-slate-50"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-light text-brand">{icon}</span>
      <span className="flex-1">
        <span className="block font-semibold text-navy-dark">{title}</span>
        <span className="block text-sm text-slate-500">{subtitle}</span>
      </span>
      <Chevron />
    </Link>
  );
}

const ROLE_LABEL: Record<string, string> = {
  dealer: "סוחר",
  admin: "מנהל",
  super_admin: "מנהל ראשי",
};

export default function AccountPage() {
  const router = useRouter();
  const { ready, email, profile } = useProfile();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (!ready) return null;

  const isAdmin = isAdminRole(profile?.role);
  const displayName = profile?.full_name || profile?.company || email || "";

  return (
    <div className="container-app py-8">
      <p className="eyebrow mb-1.5">החשבון שלך</p>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-navy-dark">האזור האישי</h1>

      {/* Profile summary */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl bg-navy-dark px-5 py-5 text-white shadow-navy">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/10 text-2xl font-bold text-gold">
          {displayName.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{displayName}</p>
          <p className="truncate text-sm text-white/60">{email}</p>
          {profile?.role && (
            <span className="mt-1 inline-block rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold">
              {ROLE_LABEL[profile.role] ?? profile.role}
            </span>
          )}
        </div>
      </div>

      {/* Menu */}
      <div className="space-y-2.5">
        <MenuRow href="/account/orders"   icon={<PackageIcon />}     title="ההזמנות שלי"        subtitle="מעקב אחר ההזמנות והסטטוס" />
        <MenuRow href="/account/quotes"   icon={<QuoteIcon />}       title="הצעות מחיר"          subtitle="הצעות המחיר שהונפקו עבורך" />
        <MenuRow href="/account/security" icon={<FingerprintIcon />} title="אבטחה וטביעת אצבע"   subtitle="כניסה ביומטרית ללא סיסמה" />
        {isAdmin && (
          <MenuRow href="/admin" icon={<SettingsIcon />} title="לוח ניהול" subtitle="ניהול המוצרים, ההזמנות והלקוחות" />
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="mt-8 w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50"
      >
        יציאה מהחשבון
      </button>
    </div>
  );
}
