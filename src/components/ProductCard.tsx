import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { computeMargin } from "@/lib/margin";
import { asset } from "@/lib/config";

export default function ProductCard({
  product,
  showPrice,
}: {
  product: Product;
  showPrice: boolean;
}) {
  // `cost` is masked from the products view to super admins only, so it is
  // present (> 0) only for them — the cost/margin line below is therefore
  // self-gating: dealers never receive a cost and never see it.
  const margin = product.cost > 0 ? computeMargin(product.price, product.cost) : null;
  return (
    <Link
      href={`/product?slug=${product.slug}`}
      className="card card-hover group overflow-hidden"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image_url ?? asset("/placeholder.svg")}
          alt={product.name_he}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {showPrice && product.stock <= 0 && (
          <span className="absolute top-2 right-2 badge bg-wine text-white shadow-sm">אזל</span>
        )}
      </div>
      <div className="space-y-1.5 p-4">
        {product.short_desc_he && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">{product.short_desc_he}</p>
        )}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-800">
          {product.name_he}
        </h3>
        <div className="flex items-center justify-between pt-2">
          {showPrice ? (
            <span className="text-lg font-extrabold tracking-tight text-navy-dark">
              {formatPrice(product.price, product.currency)}
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-400">מחיר לסוחרים</span>
          )}
          {showPrice && product.stock > 0 && (
            <span className="badge gap-1 bg-emerald-50 text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              במלאי
            </span>
          )}
        </div>
        {margin && (
          <div className="mt-1.5 space-y-0.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">מחיר מכירה</span>
              <span className="font-semibold text-navy-dark">{formatPrice(product.price, product.currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">עלות</span>
              <span className="font-medium text-slate-600">{formatPrice(product.cost, product.currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">רווח</span>
              <span
                className={`font-semibold ${
                  margin.belowCost ? "text-rose-600" : margin.thin ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {margin.belowCost
                  ? "הפסד ⚠"
                  : `${formatPrice(product.price - product.cost, product.currency)} (${margin.marginPct.toFixed(0)}%)`}
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
