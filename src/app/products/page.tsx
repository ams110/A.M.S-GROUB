"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession, canSeePrices } from "@/lib/useSession";
import ProductCard from "@/components/ProductCard";
import type { Category, Product } from "@/lib/types";

function ProductsView() {
  const params = useSearchParams();
  const category = params.get("category") ?? "";
  const q = params.get("q") ?? "";

  const { profile } = useSession();
  const showPrice = canSeePrices(profile);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .order("sort");
      const catList = (cats as Category[]) ?? [];
      setCategories(catList);

      const categoryId = category
        ? catList.find((c) => c.slug === category)?.id ?? null
        : null;

      let query = supabase
        .from("products")
        .select("*")
        .is("deleted_at", null)
        .order("sort");
      if (categoryId) query = query.eq("category_id", categoryId);
      if (q) query = query.ilike("name_he", `%${q}%`);

      const { data } = await query;
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    })();
  }, [category, q]);

  return (
    <div className="container-app py-10">
      <h1 className="mb-2 text-2xl font-bold">קטלוג מוצרים</h1>
      {!showPrice && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          המחירים וההזמנה זמינים לסוחרים מאושרים בלבד.{" "}
          <Link href="/login" className="font-semibold underline">כניסה</Link> או{" "}
          <Link href="/register" className="font-semibold underline">הרשמה</Link>.
        </p>
      )}

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <form action="/products" className="mb-4">
            <input name="q" defaultValue={q} placeholder="חיפוש מוצר…" className="input" />
          </form>
          <Link
            href="/products"
            className={`block rounded-lg px-3 py-2 text-sm ${
              !category ? "bg-brand text-white" : "hover:bg-slate-100"
            }`}
          >
            כל הקטגוריות
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/products?category=${c.slug}`}
              className={`block rounded-lg px-3 py-2 text-sm ${
                category === c.slug ? "bg-brand text-white" : "hover:bg-slate-100"
              }`}
            >
              {c.name_he}
            </Link>
          ))}
        </aside>

        <div>
          <p className="mb-4 text-sm text-slate-500">
            {loading ? "טוען…" : `${products.length} מוצרים`}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} showPrice={showPrice} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="container-app py-16 text-center">טוען…</div>}>
      <ProductsView />
    </Suspense>
  );
}
