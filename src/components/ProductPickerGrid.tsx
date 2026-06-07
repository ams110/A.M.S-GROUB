"use client";

/**
 * Visual product picker — a full-screen grid of product cards (image + name +
 * price) with search and category filters. Tapping a card adds it; added cards
 * show a "נוסף ✓" badge. Built for the quote / order builders so the admin
 * picks products by sight (like the catalogue) instead of hunting for SKUs.
 *
 * Portaled to <body> so it floats above the header / bottom nav.
 */

import { useMemo, useState } from "react";
import Portal from "./Portal";
import { productImage } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

export function ProductPickerGrid({
  products,
  categories,
  addedIds,
  onAdd,
  onClose,
}: {
  products: Product[];
  categories: Category[];
  addedIds: string[];
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const added = new Set(addedIds);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      if (cat && p.category_id !== cat) return false;
      if (!s) return true;
      return (
        p.name_he.toLowerCase().includes(s) ||
        (p.sku ?? "").toLowerCase().includes(s) ||
        (p.barcode ?? "").toLowerCase().includes(s)
      );
    });
  }, [products, q, cat]);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1 text-xs transition ${
      active ? "bg-gold-gradient font-semibold text-navy-dark" : "bg-white/10 text-white/70 hover:bg-white/15"
    }`;

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex flex-col bg-navy-dark/80 backdrop-blur-sm" role="dialog" aria-modal="true">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
          {/* Search + done */}
          <div className="flex items-center gap-2 p-3">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש מוצר (שם / מק״ט)…"
              className="input flex-1"
            />
            <button type="button" onClick={onClose} className="btn-gold shrink-0">
              סיום ({addedIds.length})
            </button>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto px-3 pb-2">
            <button type="button" onClick={() => setCat("")} className={chip(cat === "")}>
              הכל
            </button>
            {categories.map((c) => (
              <button key={c.id} type="button" onClick={() => setCat(c.id)} className={chip(cat === c.id)}>
                {c.name_he}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filtered.map((p) => {
                const isAdded = added.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onAdd(p.id)}
                    className={`card overflow-hidden text-right transition ${isAdded ? "ring-2 ring-gold" : "hover:ring-1 hover:ring-gold/40"}`}
                  >
                    <div className="relative aspect-square bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={productImage(p.image_url)}
                        alt={p.name_he}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {isAdded && (
                        <span className="absolute right-1 top-1 rounded-full bg-gold-gradient px-2 py-0.5 text-[10px] font-bold text-navy-dark">
                          נוסף ✓
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="line-clamp-2 min-h-[2rem] text-xs font-medium">{p.name_he}</p>
                      <p className="mt-1 text-sm font-bold text-gold">{formatPrice(p.price)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <p className="py-12 text-center text-sm text-white/50">לא נמצאו מוצרים.</p>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
