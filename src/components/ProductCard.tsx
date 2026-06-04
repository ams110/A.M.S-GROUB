import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { asset } from "@/lib/config";

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
      <div className="space-y-1 p-4">
        {product.short_desc_he && (
          <p className="text-xs font-medium text-brand">{product.short_desc_he}</p>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-800">
          {product.name_he}
        </h3>
        <div className="flex items-center justify-between pt-2">
          {showPrice ? (
            <span className="text-base font-extrabold text-brand-dark">
              {formatPrice(product.price, product.currency)}
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-400">מחיר לסוחרים</span>
          )}
          {showPrice && product.stock > 0 && (
            <span className="badge bg-emerald-50 text-emerald-700">
              במלאי: {product.stock}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
