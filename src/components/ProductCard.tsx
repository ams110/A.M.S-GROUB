import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { PLACEHOLDER } from "@/lib/assets";

export default function ProductCard({
  product,
  showPrice,
}: {
  product: Product;
  showPrice: boolean;
}) {
  return (
    <Link
      href={`/product?slug=${product.slug}`}
      className="card group overflow-hidden transition hover:shadow-md"
    >
      <div className="aspect-square overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image_url ?? PLACEHOLDER}
          alt={product.name_he}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      </div>
      <div className="space-y-1 p-4">
        {product.short_desc_he && (
          <p className="text-xs text-brand">{product.short_desc_he}</p>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-800">
          {product.name_he}
        </h3>
        <div className="flex items-center justify-between pt-2">
          {showPrice ? (
            <span className="text-base font-bold text-brand-dark">
              {formatPrice(product.price, product.currency)}
            </span>
          ) : (
            <span className="text-xs text-slate-400">מחיר לסוחרים</span>
          )}
          {showPrice && (
            <span
              className={`badge ${
                product.stock > 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {product.stock > 0 ? `במלאי: ${product.stock}` : "אזל"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
