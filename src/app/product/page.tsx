"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { applyEffectivePrices } from "@/lib/pricing";
import { asset } from "@/lib/config";
import AddToCart from "@/components/AddToCart";
import ProductCard from "@/components/ProductCard";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

function ProductDetail() {
  const slug = useSearchParams().get("slug") ?? "";
  const { showPrice } = useProfile();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(slug !== "");

  useEffect(() => {
    if (!slug) return;
    const supabase = createClient();
    (async () => {
      setLoading(true);
      setRelated([]);
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .is("deleted_at", null)
        .single();
      const prod = (data as Product) ?? null;
      setProduct(prod ? (await applyEffectivePrices(supabase, [prod]))[0] : null);
      setLoading(false);

      // Related: same category, still orderable, excluding this product.
      if (prod?.category_id) {
        const { data: rel } = await supabase
          .from("products")
          .select("*")
          .eq("category_id", prod.category_id)
          .neq("id", prod.id)
          .is("deleted_at", null)
          .order("sort")
          .limit(4);
        setRelated(await applyEffectivePrices(supabase, (rel as Product[]) ?? []));
      }
    })();
  }, [slug]);

  if (loading) {
    return <div className="container-app py-16 text-center text-slate-500">טוען…</div>;
  }

  if (!product) {
    return (
      <div className="container-app py-20 text-center">
        <h1 className="text-2xl font-bold">המוצר לא נמצא</h1>
        <Link href="/products" className="btn-primary mt-6 inline-flex">
          חזרה לקטלוג
        </Link>
      </div>
    );
  }

  const specs = Object.entries(product.specs ?? {});

  return (
    <div className="container-app py-10">
      <Link href="/products" className="text-sm text-brand hover:underline">
        ← חזרה לקטלוג
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="aspect-square bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_url ?? asset("/placeholder.svg")}
              alt={product.name_he}
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div>
          {product.short_desc_he && (
            <p className="text-sm font-medium text-brand">{product.short_desc_he}</p>
          )}
          <h1 className="mt-1 text-2xl font-bold">{product.name_he}</h1>
          {product.sku && (
            <p className="mt-1 text-sm text-slate-500">מק״ט: {product.sku}</p>
          )}

          <div className="my-5">
            {showPrice ? (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-brand-dark">
                  {formatPrice(product.price, product.currency)}
                </span>
                <span className="text-sm text-slate-500">מחיר לסוחר · ללא מע״מ</span>
              </div>
            ) : (
              <span className="text-lg font-medium text-slate-400">
                מחיר לסוחרים מאושרים
              </span>
            )}
          </div>

          {product.description_he && (
            <p className="mb-6 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {product.description_he}
            </p>
          )}

          {showPrice && product.is_orderable && product.stock > 0 && product.stock <= 5 && (
            <p className="mb-3 inline-block rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
              ⚡ נותרו {product.stock} במלאי — מומלץ להזדרז
            </p>
          )}
          {showPrice && product.stock > 5 && (
            <p className="mb-3 text-sm font-medium text-emerald-600">✓ במלאי</p>
          )}

          <div className="mb-6 max-w-sm">
            {showPrice && !product.is_orderable ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
                מוצר זה אינו זמין כעת
              </div>
            ) : (
              <>
                <AddToCart
                  canOrder={showPrice}
                  line={{
                    product_id: product.id,
                    slug: product.slug,
                    name_he: product.name_he,
                    price: product.price,
                    image_url: product.image_url,
                    min_order_qty: product.min_order_qty,
                    stock: product.stock,
                  }}
                />
                {showPrice && product.min_order_qty > 1 && (
                  <p className="mt-2 text-xs text-slate-500">
                    כמות מינימום להזמנה: {product.min_order_qty}
                  </p>
                )}
              </>
            )}
          </div>

          {specs.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-bold">מפרט טכני</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {specs.map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-slate-100 py-1">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {product.datasheet_url && (
            <a
              href={product.datasheet_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
            >
              הורדת דף נתונים (PDF) ↓
            </a>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-extrabold tracking-tight text-navy-dark">מוצרים דומים</h2>
            <Link href="/products" className="text-sm font-semibold text-brand hover:underline">לקטלוג ←</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} showPrice={showPrice} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<div className="container-app py-16 text-center text-slate-500">טוען…</div>}>
      <ProductDetail />
    </Suspense>
  );
}
