"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartLine = {
  product_id: string;
  slug: string;
  name_he: string;
  price: number;
  image_url: string | null;
  qty: number;
  min_order_qty: number;
  stock: number;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (product_id: string, qty: number) => void;
  remove: (product_id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "tiandy_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const clamp = (l: CartLine, qty: number) =>
      Math.max(l.min_order_qty || 1, Math.min(qty, l.stock || qty));

    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((n, l) => n + l.qty * l.price, 0),
      add: (line, qty = 1) =>
        setLines((prev) => {
          const existing = prev.find((l) => l.product_id === line.product_id);
          if (existing) {
            return prev.map((l) =>
              l.product_id === line.product_id
                ? { ...l, qty: clamp(l, l.qty + qty) }
                : l
            );
          }
          const newLine: CartLine = { ...line, qty };
          return [...prev, { ...newLine, qty: clamp(newLine, qty) }];
        }),
      setQty: (product_id, qty) =>
        setLines((prev) =>
          prev.map((l) =>
            l.product_id === product_id ? { ...l, qty: clamp(l, qty) } : l
          )
        ),
      remove: (product_id) =>
        setLines((prev) => prev.filter((l) => l.product_id !== product_id)),
      clear: () => setLines([]),
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
