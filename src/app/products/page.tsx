import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext, canSeePrices } from "@/lib/auth";
import ProductCard from "@/components/ProductCard";
import type { Category, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const supabase = await createClient();
  const { profile } = await getSessionContext();
  const showPrice = canSeePrices(profile);

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("sort");

  let categoryId: string | null = null;
  if (category) {
    categoryId =
      (categories as Category[] | null)?.find((c) => c.slug === category)?.id ??
      null;
  }

  let query = supabase
    .from("products")
    .select("*")
    .is("deleted_at", null)
    .order("sort");

  if (categoryId) query = query.eq("category_id", categoryId);
  if (q) query = query.ilike("name_he", `%${q}%`);

  const { data: products } = await query;

  return (
    <div className="container-app py-10">
      <h1 className="mb-2 text-2xl font-bold">קטלוג מוצרים</h1>
      {!showPrice && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          המחירים וההזמנה זמינים לסוחרים מאושרים בלבד.{" "}
          <Link href="/login" className="font-semibold underline">
            כניסה
          </Link>{" "}
          או{" "}
          <Link href="/register" className="font-semibold underline">
            הרשמה
          </Link>
          .
        </p>
      )}

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-1">
          <form action="/products" className="mb-4">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="חיפוש מוצר…"
              className="input"
            />
          </form>
          <Link
            href="/products"
            className={`block rounded-lg px-3 py-2 text-sm ${
              !category ? "bg-brand text-white" : "hover:bg-slate-100"
            }`}
          >
            כל הקטגוריות
          </Link>
          {(categories as Category[] | null)?.map((c) => (
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

        {/* Grid */}
        <div>
          <p className="mb-4 text-sm text-slate-500">
            {(products as Product[] | null)?.length ?? 0} מוצרים
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(products as Product[] | null)?.map((p) => (
              <ProductCard key={p.id} product={p} showPrice={showPrice} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
