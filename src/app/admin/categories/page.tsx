"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/storage";
import { slugify } from "@/lib/slug";
import { asset } from "@/lib/config";
import type { Category } from "@/lib/types";

export default function AdminCategoriesPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // New-category form.
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("categories").select("*").order("sort");
    setRows((data as Category[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (id: string, p: Partial<Category>) =>
    setRows((r) => r.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const create = async () => {
    if (!name.trim()) return;
    setError(null);
    setCreating(true);
    const sort = rows.length ? Math.max(...rows.map((r) => r.sort)) + 1 : 0;
    const { error } = await supabase
      .from("categories")
      .insert({ name_he: name.trim(), slug: slugify(name), sort });
    setCreating(false);
    if (error) {
      setError(error.code === "23505" ? "ה-slug כבר קיים." : error.message);
      return;
    }
    setName("");
    load();
  };

  const save = async (c: Category) => {
    setError(null);
    const { error } = await supabase
      .from("categories")
      .update({ name_he: c.name_he, slug: c.slug, sort: c.sort, image_url: c.image_url })
      .eq("id", c.id);
    if (error) setError(error.message);
  };

  const onUpload = async (c: Category, file: File) => {
    setUploadingId(c.id);
    try {
      const url = await uploadImage(file, "categories");
      patch(c.id, { image_url: url });
      await supabase.from("categories").update({ image_url: url }).eq("id", c.id);
    } catch (e) {
      setError(`העלאה נכשלה: ${e instanceof Error ? e.message : e}`);
    } finally {
      setUploadingId(null);
    }
  };

  const remove = async (c: Category) => {
    if (!confirm(`למחוק את הקטגוריה "${c.name_he}"? מוצרים משויכים יישארו ללא קטגוריה.`))
      return;
    setRows((r) => r.filter((x) => x.id !== c.id));
    // Detach products first so the foreign key doesn't block the delete.
    await supabase.from("products").update({ category_id: null }).eq("category_id", c.id);
    await supabase.from("categories").delete().eq("id", c.id);
  };

  if (loading) return <p className="text-slate-500">טוען…</p>;

  return (
    <div className="max-w-3xl">
      <h2 className="mb-4 text-lg font-bold">קטגוריות</h2>

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1">
          <label className="label">שם קטגוריה חדשה</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
        </div>
        <button onClick={create} disabled={creating} className="btn-primary">
          {creating ? "מוסיף…" : "+ הוספה"}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="space-y-3">
        {rows.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center gap-3 p-3">
            <label className="cursor-pointer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image_url ?? asset("/placeholder.svg")}
                alt=""
                className="h-12 w-12 rounded object-cover"
              />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(c, f);
                }}
              />
            </label>
            {uploadingId === c.id && <span className="text-xs text-slate-500">מעלה…</span>}
            <input
              className="input flex-1"
              value={c.name_he}
              onChange={(e) => patch(c.id, { name_he: e.target.value })}
            />
            <input
              className="input ltr-input w-40"
              dir="ltr"
              value={c.slug}
              onChange={(e) => patch(c.id, { slug: e.target.value })}
            />
            <input
              type="number"
              className="input w-20"
              value={c.sort}
              onChange={(e) => patch(c.id, { sort: Number(e.target.value) })}
            />
            <button onClick={() => save(c)} className="btn-outline py-1">
              שמירה
            </button>
            <button
              onClick={() => remove(c)}
              className="text-slate-400 hover:text-rose-600"
              title="מחיקה"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
