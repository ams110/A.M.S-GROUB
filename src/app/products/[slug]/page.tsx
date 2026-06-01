import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext, canSeePrices } from "@/lib/auth";
import AddToCart from "@/components/AddToCart";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { profile } = await getSessionContext();
  const showPrice = canSeePrices(profile);

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();

  if (!data) notFound();
  const product = data as Product;
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
              src={product.image_url ?? "/placeholder.svg"}
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

          <div className="mb-6 max-w-sm">
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
    </div>
  );
}
