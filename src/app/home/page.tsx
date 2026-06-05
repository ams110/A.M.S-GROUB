"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile, isAdminRole } from "@/lib/auth";
import { useCart } from "@/components/CartProvider";
import { applyEffectivePrices } from "@/lib/pricing";
import ProductCard from "@/components/ProductCard";
import OpsCenter from "@/components/OpsCenter";
import Aurora from "@/components/Aurora";
import { buildReorderSuggestions, isDue } from "@/lib/reorder";
import type { Order, OrderItem, Product } from "@/lib/types";

function greeting(h: number) {
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

// "ראשי" (home) — role-aware: admins get the live control center,
// dealers get their personalised landing page.
export default function HomePage() {
  const { profile, ready } = useProfile();
  if (!ready) return <div className="container-app py-20 text-center text-slate-400">טוען…</div>;
  if (isAdminRole(profile?.role)) return <div className="container-app py-8"><OpsCenter /></div>;
  return <DealerHome />;
}

function DealerHome() {
  const { profile, showPrice } = useProfile();
  const { count } = useCart();
  const [hero, setHero] = useState<{ title: string; subtitle: string; image: string }>({
    title: "",
    subtitle: "",
    image: "",
  });
  const [featured, setFeatured] = useState<Product[]>([]);
  const [stats, setStats] = useState<{ orders: number; quotes: number }>({ orders: 0, quotes: 0 });
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [settingsRes, featRes, ordersRes, quotesRes] = await Promise.all([
        supabase.from("settings").select("key,value"),
        supabase.from("products").select("*").is("deleted_at", null).eq("is_featured", true).order("sort").limit(8),
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("quotes").select("*", { count: "exact", head: true }),
      ]);
      const s = Object.fromEntries((settingsRes.data ?? []).map((r: any) => [r.key, r.value ?? ""]));
      setHero({
        title: s.hero_title || "ברוכים הבאים לפורטל הסיטונאי",
        subtitle: s.hero_subtitle || "מצלמות, מקליטים ובקרת כניסה במחירי סוחר.",
        image: s.hero_image_url || "",
      });
      setFeatured(await applyEffectivePrices(supabase, (featRes.data as Product[]) ?? []));
      setStats({ orders: ordersRes.count ?? 0, quotes: quotesRes.count ?? 0 });
      setLoading(false);

      // "Time to reorder": how many regularly-bought items are due a refill.
      const { data: orders } = await supabase
        .from("orders")
        .select("id,created_at")
        .order("created_at", { ascending: false });
      const orderList = (orders as Pick<Order, "id" | "created_at">[]) ?? [];
      if (orderList.length) {
        const { data: items } = await supabase
          .from("order_items")
          .select("order_id,product_id,name_he,sku,qty,unit_price")
          .in("order_id", orderList.map((o) => o.id));
        const suggestions = buildReorderSuggestions(orderList, (items as OrderItem[]) ?? []);
        setDueCount(suggestions.filter(isDue).length);
      }
    })();
  }, []);

  const name = profile?.company || profile?.full_name || "";
  const h = new Date().getHours();

  return (
    <div className="container-app space-y-8 py-8">
      {/* ── Hero banner ───────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-onyx-gradient p-7 shadow-onyx sm:p-10">
        {hero.image && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            <div className="absolute inset-0 bg-onyx-gradient/80" style={{ background: "linear-gradient(90deg,#0C0B0A 10%,rgba(12,11,10,0.7) 60%,rgba(12,11,10,0.4))" }} />
          </>
        )}
        {!hero.image && <Aurora />}
        <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative z-10 max-w-xl">
          <p className="eyebrow text-gold/80">{greeting(h)}{name ? ` · ${name}` : ""}</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl">{hero.title}</h1>
          <p className="mt-3 text-base leading-relaxed text-white/65">{hero.subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/products" className="btn-gold btn-lg">לקטלוג ←</Link>
            <Link href="/account/orders" className="btn-lg inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/8 px-5 py-3 text-base font-semibold text-white transition hover:bg-white/12">ההזמנות שלי</Link>
          </div>
        </div>
      </section>

      {/* ── Time to reorder nudge ─────────────────────────────── */}
      {dueCount > 0 && (
        <Link
          href="/account/reorder"
          className="flex items-center justify-between gap-4 rounded-2xl border border-gold/30 bg-gold-50 px-5 py-4 transition hover:brightness-[0.98]"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-gradient text-xl text-navy-dark shadow-gold">🔁</span>
            <div>
              <p className="font-bold text-navy-dark">הגיע הזמן לחדש מלאי</p>
              <p className="text-sm text-slate-600">{dueCount} מוצרים שאתה מזמין בקביעות ממתינים להזמנה חוזרת</p>
            </div>
          </div>
          <span className="shrink-0 text-sm font-bold text-gold-dark">להזמנה חוזרת ←</span>
        </Link>
      )}

      {/* ── Quick stats ───────────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-3 sm:gap-4">
        <QuickStat href="/account/orders" label="ההזמנות שלי" value={loading ? "…" : stats.orders} icon="📦" />
        <QuickStat href="/account/quotes" label="הצעות מחיר" value={loading ? "…" : stats.quotes} icon="📝" />
        <QuickStat href="/cart" label="בעגלה" value={count} icon="🛒" />
      </section>

      {/* ── Featured products ─────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="eyebrow mb-1">נבחרים עבורך</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-navy-dark">מוצרים מומלצים</h2>
          </div>
          <Link href="/products" className="text-sm font-semibold text-brand hover:underline">הכל ←</Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-black/5" />)}
          </div>
        ) : featured.length === 0 ? (
          <div className="card p-10 text-center text-slate-400">
            אין מוצרים מומלצים כרגע.{" "}
            <Link href="/products" className="font-semibold text-brand underline">עברו לקטלוג</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => <ProductCard key={p.id} product={p} showPrice={showPrice} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function QuickStat({ href, label, value, icon }: { href: string; label: string; value: number | string; icon: string }) {
  return (
    <Link href={href} className="card card-hover flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-50 text-xl ring-1 ring-gold/20">{icon}</span>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold leading-none text-navy-dark">{value}</div>
        <div className="mt-1 truncate text-xs text-slate-500">{label}</div>
      </div>
    </Link>
  );
}
