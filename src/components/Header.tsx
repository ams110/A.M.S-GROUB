"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "./CartProvider";

export default function Header() {
  const { count } = useCart();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      setEmail(user?.email ?? null);
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setRole(data?.role ?? null);
      } else {
        setRole(null);
      }
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  // Links shared by the desktop nav and the mobile menu.
  const links = (
    <>
      <Link href="/products" className="hover:text-brand" onClick={() => setMenuOpen(false)}>
        קטלוג
      </Link>
      {email && (
        <Link href="/account/orders" className="hover:text-brand" onClick={() => setMenuOpen(false)}>
          ההזמנות שלי
        </Link>
      )}
      {email && (
        <Link href="/account/quotes" className="hover:text-brand" onClick={() => setMenuOpen(false)}>
          הצעות מחיר
        </Link>
      )}
      {role === "admin" && (
        <Link href="/admin" className="font-semibold text-brand" onClick={() => setMenuOpen(false)}>
          ניהול
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand font-bold text-white">
            T
          </span>
          <span className="text-lg font-bold text-brand-dark">Tiandy סוחרים</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {links}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/cart" className="relative btn-outline">
            🛒 עגלה
            {count > 0 && (
              <span className="absolute -top-2 -left-2 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          {email ? (
            <button onClick={signOut} className="btn-outline">
              יציאה
            </button>
          ) : (
            <Link href="/login" className="btn-primary">
              כניסת סוחרים
            </Link>
          )}
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="btn-outline px-3 md:hidden"
            aria-label="תפריט"
            aria-expanded={menuOpen}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 md:hidden">
          {links}
        </nav>
      )}
    </header>
  );
}
