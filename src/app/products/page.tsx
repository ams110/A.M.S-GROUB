"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { applyEffectivePrices } from "@/lib/pricing";
import { matchProductByCode } from "@/lib/barcode";
import ProductCard from "@/components/ProductCard";
import BarcodeScanner from "@/components/BarcodeScanner";
import type { Category, Product } from "@/lib/types";

type SortKey = "default" | "name" | "price-asc" | "price-desc";

// Catalogue renders incrementally so a large product list (1000+ items) stays
// snappy: we fetch the full set for client-side search/sort/filter, but only
// paint PAGE_SIZE cards at a time and reveal more on demand.
const PAGE_SIZE = 24;

function Catalog() {
  const params = useSearchParams();
  const router = useRouter();
  const category = params.get("category") ?? undefined;
  const q = params.get("q") ?? undefined;

  const { showPrice } = useProfile();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("default");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [search, setSearch] = useState(q ?? "");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const { data: cats } = await supabase.from("categories").select("*").order("sort");
      const categoryList = (cats as Category[]) ?? [];
      setCategories(categoryList);

      const categoryId = category
        ? categoryList.find((c) => c.slug === category)?.id ?? null
        : null;

      // Only catalogue products that are available (is_orderable). Admins hide a
      // product from the storefront by unchecking "למכירה" in /admin/products,
      // and restore it the same way — without deleting the row.
      let query = supabase
        .from("products")
        .select("*")
        .is("deleted_at", null)
        .eq("is_orderable", true)
        .order("sort");
      if (categoryId) query = query.eq("category_id", categoryId);
      // Dealers search by model/SKU as often as by name — match both.
      if (q) query = query.or(`name_he.ilike.%${q}%,sku.ilike.%${q}%`);

      const { data } = await query;
      setProducts(await applyEffectivePrices(supabase, (data as Product[]) ?? []));
      setLoading(false);
    })();
  }, [category, q]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const url = new URLSearchParams();
    if (search) url.set("q", search);
    if (category) url.set("category", category);
    router.push(`/products?${url.toString()}`);
  };

  // A scanned barcode/SKU jumps straight to the product when we can resolve it
  // against the loaded catalogue; otherwise it falls back to a full search.
  const handleScan = (code: string) => {
    setShowScanner(false);
    const hit = matchProductByCode(products, code);
    if (hit) {
      router.push(`/product?slug=${hit.slug}`);
    } else {
      setSearch(code);
      router.push(`/products?q=${encodeURIComponent(code.trim())}`);
    }
  };

  const sorted = [...products]
    .filter((p) => !inStockOnly || p.stock > 0)
    .sort((a, b) => {
      if (sort === "name") return a.name_he.localeCompare(b.name_he, "he");
      if (sort === "price-asc") return (a.price ?? 0) - (b.price ?? 0);
      if (sort === "price-desc") return (b.price ?? 0) - (a.price ?? 0);
      return 0;
    });

  // Reset the visible window whenever the result set or its ordering changes,
  // so a new search/filter always starts from the first page.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [products, sort, inStockOnly]);

  const shown = sorted.slice(0, visible);
  const hasMore = sorted.length > visible;

  const navLinks = (
    <div className="space-y-1">
      <Link
        href="/products"
        onClick={() => setSidebarOpen(false)}
        className={`block rounded-lg px-3 py-2 text-sm ${
          !category ? "bg-gold-gradient font-semibold text-navy-dark shadow-gold" : "text-slate-600 hover:bg-gold-50 hover:text-navy"
        }`}
      >
        כל הקטגוריות
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/products?category=${c.slug}`}
          onClick={() => setSidebarOpen(false)}
          className={`block rounded-lg px-3 py-2 text-sm ${
            category === c.slug ? "bg-gold-gradient font-semibold text-navy-dark shadow-gold" : "text-slate-600 hover:bg-gold-50 hover:text-navy"
          }`}
        >
          {c.name_he}
        </Link>
      ))}
    </div>
  );

  return (
    <div className="container-app py-8">
      <div className="mb-6">
        <p className="eyebrow mb-1.5">Tiandy · קטלוג רשמי</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-navy-dark">
          קטלוג <span className="text-gradient-gold">מוצרים</span>
        </h1>
      </div>

      {!showPrice && (
        <p className="mb-5 rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          המחירים וההזמנה זמינים לסוחרים מאושרים בלבד.{" "}
          <Link href="/login" className="font-semibold underline">כניסה</Link>.
        </p>
      )}

      {/* Search + filters bar */}
      <div className="card mb-6 flex flex-wrap items-center gap-3 p-3">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2 min-w-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או מק״ט…"
            className="input min-w-0 flex-1"
          />
          <button type="submit" className="btn-primary shrink-0">חפש</button>
        </form>

        {/* Barcode / QR scan — straight from the box to the catalogue */}
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="btn-outline shrink-0 gap-1.5"
          aria-label="סריקת ברקוד"
          title="סריקת ברקוד / QR"
        >
          <span aria-hidden>📷</span>
          <span className="hidden sm:inline">סריקה</span>
        </button>

        {/* Mobile category toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="btn-outline md:hidden"
        >
          קטגוריות ▾
        </button>

        {showPrice && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="input w-auto"
          >
            <option value="default">מיון: ברירת מחדל</option>
            <option value="name">מיון: שם</option>
            <option value="price-asc">מחיר: זול לייקר</option>
            <option value="price-desc">מחיר: יקר לזול</option>
          </select>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          זמין במלאי בלבד
        </label>
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 md:hidden">
          {navLinks}
        </div>
      )}

      {showScanner && (
        <BarcodeScanner onDetect={handleScan} onClose={() => setShowScanner(false)} />
      )}

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden md:block">
          <div className="card sticky top-20 p-3">
            <p className="eyebrow mb-2 px-1">קטגוריות</p>
            {navLinks}
          </div>
        </aside>

        {/* Grid */}
        <div>
          <p className="mb-4 text-sm text-slate-500">
            {loading
              ? "טוען…"
              : hasMore
                ? `מציג ${shown.length} מתוך ${sorted.length} מוצרים`
                : `${sorted.length} מוצרים`}
          </p>
          {!loading && sorted.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400">
              לא נמצאו מוצרים תואמים.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((p) => (
              <ProductCard key={p.id} product={p} showPrice={showPrice} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="btn-outline"
              >
                טען עוד מוצרים
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="container-app py-16 text-center text-slate-500">טוען…</div>}>
      <Catalog />
    </Suspense>
  );
}
