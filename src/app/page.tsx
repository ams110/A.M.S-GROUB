import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext, canSeePrices } from "@/lib/auth";
import ProductCard from "@/components/ProductCard";
import type { Category, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { profile } = await getSessionContext();
  const showPrice = canSeePrices(profile);

  const [{ data: settings }, { data: categories }, { data: featured }] =
    await Promise.all([
      supabase.from("tiandy_il_settings").select("key,value"),
      supabase.from("tiandy_il_categories").select("*").order("sort"),
      supabase
        .from("tiandy_il_products")
        .select("*")
        .is("deleted_at", null)
        .eq("is_featured", true)
        .order("sort")
        .limit(8),
    ]);

  const s = Object.fromEntries(
    (settings ?? []).map((r) => [r.key, r.value])
  ) as Record<string, string>;

  let featuredList = (featured as Product[]) ?? [];
  if (featuredList.length === 0) {
    const { data } = await supabase
      .from("tiandy_il_products")
      .select("*")
      .is("deleted_at", null)
      .order("sort")
      .limit(8);
    featuredList = (data as Product[]) ?? [];
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-dark text-white">
        {s.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.hero_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        )}
        <div className="container-app relative py-20">
          <h1 className="max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">
            {s.hero_title ?? "פורטל הזמנות סיטונאי למוצרי Tiandy"}
          </h1>
          <p className="mt-4 max-w-xl text-base text-blue-100 md:text-lg">
            {s.hero_subtitle ??
              "הזמינו ישירות מהיבואן הרשמי — מחירי סוחרים, מלאי מעודכן ומשלוח עד הדלת."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/products" className="btn bg-white text-brand-dark hover:bg-blue-50">
              לקטלוג המלא
            </Link>
            {!profile && (
              <Link
                href="/register"
                className="btn border border-white/40 text-white hover:bg-white/10"
              >
                הרשמת סוחר חדש
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-app py-12">
        <h2 className="mb-6 text-xl font-bold">קטגוריות</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {(categories as Category[] | null)?.map((c) => (
            <Link
              key={c.id}
              href={`/products?category=${c.slug}`}
              className="card flex items-center gap-3 p-4 transition hover:shadow-md"
            >
              {c.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image_url} alt="" className="h-12 w-12 rounded object-cover" />
              ) : (
                <span className="grid h-12 w-12 place-items-center rounded bg-brand-light text-brand">
                  📷
                </span>
              )}
              <span className="text-sm font-semibold">{c.name_he}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="container-app pb-16">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">מוצרים נבחרים</h2>
          <Link href="/products" className="text-sm font-medium text-brand hover:underline">
            הצג הכל →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featuredList.map((p) => (
            <ProductCard key={p.id} product={p} showPrice={showPrice} />
          ))}
        </div>
      </section>
    </div>
  );
}
