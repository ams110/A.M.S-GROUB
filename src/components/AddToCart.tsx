"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart, type CartLine } from "./CartProvider";

export default function AddToCart({
  line,
  canOrder,
}: {
  line: Omit<CartLine, "qty">;
  canOrder: boolean;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(line.min_order_qty || 1);

  if (!canOrder) {
    return (
      <Link href="/login" className="btn-primary w-full">
        כניסת סוחרים לצפייה במחיר ולהזמנה
      </Link>
    );
  }

  if (line.stock <= 0) {
    return <button className="btn-outline w-full" disabled>אזל מהמלאי</button>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">כמות:</label>
        <input
          type="number"
          min={line.min_order_qty || 1}
          max={line.stock}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="input w-24"
        />
      </div>
      <button
        className="btn-primary w-full"
        onClick={() => {
          add(line, Math.max(line.min_order_qty || 1, qty));
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
        }}
      >
        {added ? "נוסף לעגלה ✓" : "הוספה לעגלה"}
      </button>
    </div>
  );
}
