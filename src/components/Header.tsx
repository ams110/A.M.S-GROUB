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

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand font-bold text-white">
            T
          </span>
          <span className="text-lg font-bold text-brand-dark">Tiandy סוחרים</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href="/products" className="hover:text-brand">
            קטלוג
          </Link>
          {email && (
            <Link href="/account/orders" className="hover:text-brand">
              ההזמנות שלי
            </Link>
          )}
          {role === "admin" && (
            <Link href="/admin" className="hover:text-brand">
              ניהול
            </Link>
          )}
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
        </div>
      </div>
    </header>
  );
}
