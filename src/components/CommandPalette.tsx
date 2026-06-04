"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile, isAdminRole } from "@/lib/auth";

type Item = { id: string; label: string; sub?: string; href: string; group: string };

const OPEN_EVENT = "ams:open-command";
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export default function CommandPalette() {
  const router = useRouter();
  const { profile, email } = useProfile();
  const isAdmin = isAdminRole(profile?.role);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const baseItems = useMemo<Item[]>(() => {
    const nav: Item[] = [
      { id: "n-home", label: "דף הבית", href: "/home", group: "ניווט" },
      { id: "n-catalog", label: "קטלוג מוצרים", href: "/products", group: "ניווט" },
      { id: "n-cart", label: "עגלת קניות", href: "/cart", group: "ניווט" },
    ];
    if (isAdmin) nav.push({ id: "n-admin", label: "מרכז הניהול", href: "/admin", group: "ניווט" });
    if (email) {
      nav.push(
        { id: "n-orders", label: "ההזמנות שלי", href: "/account/orders", group: "ניווט" },
        { id: "n-quotes", label: "הצעות מחיר", href: "/account/quotes", group: "ניווט" },
        { id: "n-account", label: "האזור האישי", href: "/account", group: "ניווט" },
        { id: "n-security", label: "אבטחה וטביעת אצבע", href: "/account/security", group: "ניווט" }
      );
    }
    if (isAdmin) {
      [
        ["/admin/orders", "ניהול הזמנות"],
        ["/admin/products", "ניהול מוצרים"],
        ["/admin/dealers", "לקוחות"],
        ["/admin/inventory", "מלאי"],
        ["/admin/quotes", "הצעות מחיר (ניהול)"],
        ["/admin/settings", "הגדרות האתר"],
      ].forEach(([href, label], i) => nav.push({ id: `a-${i}`, label, href, group: "ניהול" }));
    }
    return nav;
  }, [email, isAdmin]);

  // Toggle via Cmd/Ctrl+K + custom event
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Live product search (debounced)
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setProducts([]);
      return;
    }
    const t = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("id,name_he,slug,sku")
        .is("deleted_at", null)
        .ilike("name_he", `%${q}%`)
        .limit(6);
      setProducts(
        (data ?? []).map((p: any) => ({
          id: `p-${p.id}`,
          label: p.name_he,
          sub: p.sku || "מוצר",
          href: `/product?slug=${p.slug}`,
          group: "מוצרים",
        }))
      );
    }, 220);
    return () => clearTimeout(t);
  }, [query, open]);

  const filteredBase = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseItems;
    return baseItems.filter((i) => i.label.toLowerCase().includes(q));
  }, [baseItems, query]);

  const results = useMemo(() => [...filteredBase, ...products], [filteredBase, products]);

  useEffect(() => {
    if (active >= results.length) setActive(0);
  }, [results.length, active]);

  const go = (item: Item) => {
    setOpen(false);
    router.push(item.href);
  };

  if (!open) return null;

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh] print:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy-dark/60 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg animate-fade-up overflow-hidden rounded-2xl bg-white shadow-onyx ring-1 ring-navy/10">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 text-slate-400">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onListKey}
            placeholder="חיפוש מוצר, הזמנה או מעבר מהיר…"
            className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 sm:block">ESC</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">לא נמצאו תוצאות.</p>
          ) : (
            results.map((item, i) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {showGroup && (
                    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.group}</p>
                  )}
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-right text-sm transition ${
                      i === active ? "bg-gold-50 text-navy-dark" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                    {item.sub && <span className="shrink-0 text-xs text-slate-400">{item.sub}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
