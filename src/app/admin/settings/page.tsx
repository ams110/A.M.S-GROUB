"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/storage";
import { asset } from "@/lib/config";

// Curated keys shown as friendly fields. Any other keys appear under "advanced".
const KNOWN = [
  "hero_title",
  "hero_subtitle",
  "hero_image_url",
  "bank_details",
  "vat_rate",
  "business_name",
  "business_tax_id",
  "business_address",
  "business_phone",
  "business_email",
];

export default function AdminSettingsPage() {
  const supabase = createClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [extraKeys, setExtraKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings").select("key,value");
      const map = Object.fromEntries(
        (data ?? []).map((r) => [r.key, r.value ?? ""])
      ) as Record<string, string>;
      setValues(map);
      setExtraKeys(Object.keys(map).filter((k) => !KNOWN.includes(k)));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key: string, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onUploadHero = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      set("hero_image_url", await uploadImage(file, "site"));
    } catch (e) {
      setError(`העלאה נכשלה: ${e instanceof Error ? e.message : e}`);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const rows = Object.entries(values).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (loading) return <p className="text-slate-500">טוען…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-bold">הגדרות האתר</h2>

      <div className="card space-y-4 p-5">
        <h3 className="font-bold">באנר ראשי (Hero)</h3>
        <div>
          <label className="label">כותרת</label>
          <input
            className="input"
            value={values.hero_title ?? ""}
            onChange={(e) => set("hero_title", e.target.value)}
          />
        </div>
        <div>
          <label className="label">תת-כותרת</label>
          <textarea
            className="input"
            rows={3}
            value={values.hero_subtitle ?? ""}
            onChange={(e) => set("hero_subtitle", e.target.value)}
          />
        </div>
        <div>
          <label className="label">תמונת רקע</label>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={values.hero_image_url || asset("/placeholder.svg")}
              alt=""
              className="h-32 w-full rounded-lg border border-slate-200 object-cover sm:h-20 sm:w-32"
            />
            <div className="flex-1 space-y-2">
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-navy-mid"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadHero(f);
                }}
              />
              {uploading && <p className="text-xs text-slate-500">מעלה…</p>}
              <input
                className="input ltr-input"
                dir="ltr"
                placeholder="https://…"
                value={values.hero_image_url ?? ""}
                onChange={(e) => set("hero_image_url", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card space-y-3 p-5">
        <h3 className="font-bold">פרטי תשלום</h3>
        <div>
          <label className="label">פרטי חשבון להעברה בנקאית</label>
          <textarea
            className="input"
            rows={3}
            placeholder="שם המוטב, בנק, סניף, מספר חשבון…"
            value={values.bank_details ?? ""}
            onChange={(e) => set("bank_details", e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            מוצג ללקוח בעמוד ההזמנה כשנבחרה העברה בנקאית.
          </p>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <h3 className="font-bold">חשבוניות ופרטי העסק</h3>
        <div>
          <label className="label">שיעור מע״מ (%)</label>
          <input
            type="number"
            step="0.1"
            className="input max-w-[120px]"
            value={values.vat_rate ?? ""}
            onChange={(e) => set("vat_rate", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">שם העסק</label>
            <input
              className="input"
              value={values.business_name ?? ""}
              onChange={(e) => set("business_name", e.target.value)}
            />
          </div>
          <div>
            <label className="label">ח.פ / עוסק מורשה</label>
            <input
              className="input"
              value={values.business_tax_id ?? ""}
              onChange={(e) => set("business_tax_id", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">כתובת העסק</label>
            <input
              className="input"
              value={values.business_address ?? ""}
              onChange={(e) => set("business_address", e.target.value)}
            />
          </div>
          <div>
            <label className="label">טלפון</label>
            <input
              className="input"
              value={values.business_phone ?? ""}
              onChange={(e) => set("business_phone", e.target.value)}
            />
          </div>
          <div>
            <label className="label">אימייל</label>
            <input
              className="input ltr-input"
              dir="ltr"
              value={values.business_email ?? ""}
              onChange={(e) => set("business_email", e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">פרטים אלה מופיעים בראש חשבונית המס.</p>
      </div>

      {extraKeys.length > 0 && (
        <div className="card space-y-3 p-5">
          <h3 className="font-bold">הגדרות נוספות</h3>
          {extraKeys.map((k) => (
            <div key={k}>
              <label className="label ltr-input" dir="ltr">
                {k}
              </label>
              <input
                className="input"
                value={values[k] ?? ""}
                onChange={(e) => set(k, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <button onClick={save} disabled={saving || uploading} className="btn-primary">
        {saving ? "שומר…" : saved ? "נשמר ✓" : "שמירת הגדרות"}
      </button>
    </div>
  );
}
