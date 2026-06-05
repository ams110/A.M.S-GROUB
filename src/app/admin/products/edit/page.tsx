"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/storage";
import { slugify } from "@/lib/slug";
import { asset } from "@/lib/config";
import BarcodeScanner from "@/components/BarcodeScanner";
import type { Category, Product } from "@/lib/types";

type SpecRow = { key: string; value: string };

const EMPTY = {
  name_he: "",
  slug: "",
  category_id: "" as string,
  short_desc_he: "",
  description_he: "",
  image_url: "",
  datasheet_url: "",
  sku: "",
  barcode: "",
  cost: 0,
  price: 0,
  price_contractor: 0,
  currency: "ILS",
  stock: 0,
  reorder_point: 0,
  min_order_qty: 1,
  is_orderable: true,
  is_featured: false,
  sort: 0,
};

function ProductForm() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const isEdit = !!id;
  const supabase = createClient();

  const [form, setForm] = useState({ ...EMPTY });
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanBarcode, setScanBarcode] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .order("sort");
      setCategories((cats as Category[]) ?? []);

      if (isEdit) {
        const { data } = await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .single();
        const p = data as Product | null;
        if (p) {
          setForm({
            name_he: p.name_he,
            slug: p.slug,
            category_id: p.category_id ?? "",
            short_desc_he: p.short_desc_he ?? "",
            description_he: p.description_he ?? "",
            image_url: p.image_url ?? "",
            datasheet_url: p.datasheet_url ?? "",
            sku: p.sku ?? "",
            barcode: p.barcode ?? "",
            cost: p.cost ?? 0,
            price: p.price,
            price_contractor: p.price_contractor,
            currency: p.currency,
            stock: p.stock,
            reorder_point: p.reorder_point,
            min_order_qty: p.min_order_qty,
            is_orderable: p.is_orderable,
            is_featured: p.is_featured,
            sort: p.sort,
          });
          setSpecs(
            Object.entries(p.specs ?? {}).map(([key, value]) => ({
              key,
              value: String(value),
            }))
          );
          setSlugTouched(true);
        }
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  const onName = (name_he: string) =>
    set(slugTouched ? { name_he } : { name_he, slug: slugify(name_he) });

  const onUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file, "products");
      set({ image_url: url });
    } catch (e) {
      setError(`העלאת התמונה נכשלה: ${e instanceof Error ? e.message : e}`);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name_he.trim()) return setError("נא להזין שם מוצר.");

    const specsObj = Object.fromEntries(
      specs.filter((s) => s.key.trim()).map((s) => [s.key.trim(), s.value])
    );

    const payload = {
      ...form,
      slug: (form.slug || slugify(form.name_he)).trim(),
      category_id: form.category_id || null,
      sku: form.sku || null,
      barcode: form.barcode || null,
      short_desc_he: form.short_desc_he || null,
      description_he: form.description_he || null,
      image_url: form.image_url || null,
      datasheet_url: form.datasheet_url || null,
      specs: specsObj,
    };

    setSaving(true);
    const { error } = isEdit
      ? await supabase.from("products").update(payload).eq("id", id)
      : await supabase.from("products").insert(payload);
    setSaving(false);

    if (error) {
      setError(
        error.code === "23505"
          ? "ה-slug כבר קיים. בחרו כתובת אחרת."
          : `שמירה נכשלה: ${error.message}`
      );
      return;
    }
    router.push("/admin/products");
  };

  if (loading) return <p className="text-slate-500">טוען…</p>;

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{isEdit ? "עריכת מוצר" : "מוצר חדש"}</h2>
        <Link href="/admin/products" className="text-sm text-brand hover:underline">
          ← לרשימת המוצרים
        </Link>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">שם המוצר *</label>
              <input
                className="input"
                value={form.name_he}
                onChange={(e) => onName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">כתובת (slug)</label>
              <input
                className="input ltr-input"
                dir="ltr"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set({ slug: e.target.value });
                }}
              />
            </div>
            <div>
              <label className="label">קטגוריה</label>
              <select
                className="input"
                value={form.category_id}
                onChange={(e) => set({ category_id: e.target.value })}
              >
                <option value="">— ללא —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_he}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">מק״ט (SKU)</label>
              <input
                className="input"
                value={form.sku}
                onChange={(e) => set({ sku: e.target.value })}
              />
            </div>
            <div>
              <label className="label">ברקוד (EAN/UPC)</label>
              <div className="flex gap-2">
                <input
                  className="input min-w-0 flex-1"
                  value={form.barcode}
                  onChange={(e) => set({ barcode: e.target.value })}
                  placeholder="לסריקה מהיר בקופה/מלאי"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  onClick={() => setScanBarcode(true)}
                  className="btn-outline shrink-0"
                  aria-label="סריקת ברקוד"
                  title="סריקת ברקוד"
                >
                  📷
                </button>
              </div>
            </div>
          </div>

          {scanBarcode && (
            <BarcodeScanner
              title="סריקת ברקוד מוצר"
              onClose={() => setScanBarcode(false)}
              onDetect={(code) => {
                set({ barcode: code.trim() });
                setScanBarcode(false);
              }}
            />
          )}

          <div>
            <label className="label">תיאור קצר</label>
            <input
              className="input"
              value={form.short_desc_he}
              onChange={(e) => set({ short_desc_he: e.target.value })}
            />
          </div>
          <div>
            <label className="label">תיאור מלא</label>
            <textarea
              className="input"
              rows={4}
              value={form.description_he}
              onChange={(e) => set({ description_he: e.target.value })}
            />
          </div>
        </div>

        {/* Media */}
        <div className="card space-y-3 p-5">
          <h3 className="font-bold">תמונה</h3>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.image_url || asset("/placeholder.svg")}
              alt=""
              className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
            />
            <div className="flex-1 space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                }}
                className="block text-sm"
              />
              {uploading && <p className="text-xs text-slate-500">מעלה…</p>}
              <input
                className="input ltr-input"
                dir="ltr"
                placeholder="או הדביקו כתובת תמונה"
                value={form.image_url}
                onChange={(e) => set({ image_url: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">קישור לדף נתונים (PDF)</label>
            <input
              className="input ltr-input"
              dir="ltr"
              value={form.datasheet_url}
              onChange={(e) => set({ datasheet_url: e.target.value })}
            />
          </div>
        </div>

        {/* Pricing & stock */}
        <div className="card grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <label className="label">עלות (לחישוב רווח)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.cost}
              onChange={(e) => set({ cost: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-slate-400">עלות הרכש ליחידה. משמשת לחישוב הרווח בלוח הניהול.</p>
          </div>
          <div>
            <label className="label">מחיר לסוחר</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.price}
              onChange={(e) => set({ price: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">מחיר לקבלן</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.price_contractor}
              onChange={(e) => set({ price_contractor: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-slate-400">אם 0 — יחול מחיר הסוחר.</p>
          </div>
          <div>
            <label className="label">מטבע</label>
            <select
              className="input"
              value={form.currency}
              onChange={(e) => set({ currency: e.target.value })}
            >
              <option value="ILS">ILS ₪</option>
              <option value="USD">USD $</option>
              <option value="EUR">EUR €</option>
            </select>
          </div>
          <div>
            <label className="label">מלאי</label>
            <input
              type="number"
              className="input"
              value={form.stock}
              onChange={(e) => set({ stock: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">כמות מינימום להזמנה</label>
            <input
              type="number"
              className="input"
              value={form.min_order_qty}
              onChange={(e) => set({ min_order_qty: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">נקודת הזמנה (התראת מלאי)</label>
            <input
              type="number"
              className="input"
              value={form.reorder_point}
              onChange={(e) => set({ reorder_point: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">סדר תצוגה</label>
            <input
              type="number"
              className="input"
              value={form.sort}
              onChange={(e) => set({ sort: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-end gap-6 pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_orderable}
                onChange={(e) => set({ is_orderable: e.target.checked })}
              />
              ניתן להזמנה
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => set({ is_featured: e.target.checked })}
              />
              מומלץ
            </label>
          </div>
        </div>

        {/* Specs */}
        <div className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">מפרט טכני</h3>
            <button
              type="button"
              onClick={() => setSpecs((s) => [...s, { key: "", value: "" }])}
              className="text-sm text-brand hover:underline"
            >
              + שורה
            </button>
          </div>
          {specs.length === 0 && (
            <p className="text-sm text-slate-400">אין מפרט. הוסיפו שורות לפי הצורך.</p>
          )}
          {specs.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                placeholder="מאפיין"
                value={row.key}
                onChange={(e) =>
                  setSpecs((s) =>
                    s.map((r, j) => (j === i ? { ...r, key: e.target.value } : r))
                  )
                }
              />
              <input
                className="input"
                placeholder="ערך"
                value={row.value}
                onChange={(e) =>
                  setSpecs((s) =>
                    s.map((r, j) => (j === i ? { ...r, value: e.target.value } : r))
                  )
                }
              />
              <button
                type="button"
                onClick={() => setSpecs((s) => s.filter((_, j) => j !== i))}
                className="px-2 text-slate-400 hover:text-rose-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        <div className="flex gap-3">
          <button disabled={saving || uploading} className="btn-primary">
            {saving ? "שומר…" : isEdit ? "שמירת שינויים" : "יצירת מוצר"}
          </button>
          <Link href="/admin/products" className="btn-outline">
            ביטול
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function ProductEditPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">טוען…</p>}>
      <ProductForm />
    </Suspense>
  );
}
