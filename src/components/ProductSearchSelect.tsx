"use client";

/**
 * Searchable product picker — a type-to-filter combobox that replaces the long
 * native <select> used in the quote / purchase-order line items. Matches by
 * Hebrew name, SKU or barcode so finding a product in a big catalogue is fast,
 * and stays readable on a narrow phone (full-width field, themed dropdown).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/types";

export function ProductSearchSelect({
  products,
  value,
  onChange,
  placeholder = "חיפוש מוצר…",
}: {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => products.find((p) => p.id === value) ?? null,
    [products, value]
  );

  // All matching products (full list when no query) — the dropdown scrolls,
  // so we never hide products; we only cap the rendered count for very large
  // catalogues and nudge the user to refine the search.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name_he.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
    );
  }, [products, query]);

  const MAX_SHOWN = 50;
  const shown = matches.slice(0, MAX_SHOWN);

  // Close when clicking outside the widget.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Focus the search field as soon as it opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapRef} className="relative">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="input flex w-full items-center justify-between text-right"
        >
          <span className={selected ? "truncate" : "truncate text-slate-400"}>
            {selected ? selected.name_he : placeholder}
          </span>
          <span className="shrink-0 ps-2 text-slate-400">▾</span>
        </button>
      ) : (
        <>
          <input
            ref={inputRef}
            className="input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="card absolute z-30 mt-1 max-h-64 w-full overflow-y-auto p-1.5 shadow-lg">
            {matches.length === 0 ? (
              <p className="px-3 py-3 text-center text-sm text-slate-400">לא נמצא מוצר</p>
            ) : (
              <>
                {shown.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-right text-sm transition ${
                      p.id === value ? "bg-gold-50 text-navy-dark" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate">{p.name_he}</span>
                    {p.sku && (
                      <span className="shrink-0 font-mono text-xs text-slate-400">{p.sku}</span>
                    )}
                  </button>
                ))}
                {matches.length > MAX_SHOWN && (
                  <p className="px-3 py-2 text-center text-xs text-slate-400">
                    מציג {MAX_SHOWN} מתוך {matches.length} — הקלידו לחיפוש מדויק
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
