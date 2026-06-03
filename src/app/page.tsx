"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { applyEffectivePrices } from "@/lib/pricing";
import ProductCard from "@/components/ProductCard";
import type { Category, Product } from "@/lib/types";

export default function HomePage() {
  const { profile, showPrice } = useProfile();

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const [{ data: settingsRows }, { data: cats }, { data: feat }] =
        await Promise.all([
          supabase.from("settings").select("key,value"),
          supabase.from("categories").select("*").order("sort"),
          supabase
            .from("products")
            .select("*")
            .is("deleted_at", null)
            .eq("is_featured", true)
            .order("sort")
            .limit(8),
        ]);

      setSettings(
        Object.fromEntries(
          (settingsRows ?? []).map((r) => [r.key, r.value])
        ) as Record<string, string>
      );
      setCategories((cats as Category[]) ?? []);

      let featuredList = (feat as Product[]) ?? [];
      if (featuredList.length === 0) {
        const { data } = await supabase
          .from("products")
          .select("*")
          .is("deleted_at", null)
          .order("sort")
          .limit(8);
        featuredList = (data as Product[]) ?? [];
      }
      setFeatured(await applyEffectivePrices(supabase, featuredList));
    })();
  }, []);

  const s = settings;

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
            {s.hero_title ?? "פורטל הזמנות הסיטונאי של Â.M.Ŝ GROUP"}
          </h1>
          <p className="mt-4 max-w-xl text-base text-blue-100 md:text-lg">
            {s.hero_subtitle ??
              "הזמינו ישירות מהיבואן הרשמי — מחירי סוחרים, מלאי מעודכן ומשלוח עד הדלת."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/products" className="btn bg-white text-brand-dark hover:bg-blue-50">
              לקטלוג המלא
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-app py-12">
        <h2 className="mb-6 text-xl font-bold">קטגוריות</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => (
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
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} showPrice={showPrice} />
          ))}
        </div>
      </section>
    </div>
  );
}
