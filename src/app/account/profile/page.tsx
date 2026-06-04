"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile, isAdminRole } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { uploadImage } from "@/lib/storage";
import {
  formatPrice,
  CUSTOMER_TYPE_HE,
  PAYMENT_TERMS_HE,
  PROFILE_STATUS_HE,
} from "@/lib/format";

const ROLE_HE: Record<string, string> = {
  dealer: "סוחר",
  admin: "מנהל",
  super_admin: "מנהל ראשי",
};

type Form = {
  full_name: string;
  company: string;
  phone: string;
  city: string;
  address: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const { ready, userId, email, profile } = useProfile();
  const toast = useToast();
  const isAdmin = isAdminRole(profile?.role);

  const [form, setForm] = useState<Form>({ full_name: "", company: "", phone: "", city: "", address: "" });
  const [avatar, setAvatar] = useState<string>("");
  const [username, setUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [orders, setOrders] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    if (!userId) { router.replace("/"); return; }
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        company: profile.company ?? "",
        phone: profile.phone ?? "",
        city: profile.city ?? "",
        address: profile.address ?? "",
      });
      setAvatar(profile.avatar_url ?? "");
      setUsername(profile.username ?? "");
    }
    setNewEmail(email ?? "");
    const supabase = createClient();
    supabase.from("orders").select("*", { count: "exact", head: true }).then(({ count }) => setOrders(count ?? 0));
  }, [ready, userId, profile, email, router]);

  if (!ready) return <div className="container-app py-20 text-center text-slate-400">טוען…</div>;

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onPickAvatar = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file, "avatars");
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (error) throw error;
      setAvatar(url);
      toast("התמונה עודכנה ✓");
    } catch (e) {
      toast(e instanceof Error ? e.message : "העלאה נכשלה", "error");
    } finally {
      setUploading(false);
    }
  };

  const saveInfo = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const patch: Record<string, unknown> = { ...form };
      if (isAdmin) patch.username = username.trim() || null;
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) throw error;
      toast("הפרטים נשמרו ✓");
    } catch (e) {
      toast(e instanceof Error ? e.message : "השמירה נכשלה", "error");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (pw.next.length < 6) return toast("הסיסמה חייבת להכיל לפחות 6 תווים", "error");
    if (pw.next !== pw.confirm) return toast("הסיסמאות אינן תואמות", "error");
    setSavingPw(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw error;
      setPw({ next: "", confirm: "" });
      toast("הסיסמה עודכנה ✓");
    } catch (e) {
      toast(e instanceof Error ? e.message : "עדכון הסיסמה נכשל", "error");
    } finally {
      setSavingPw(false);
    }
  };

  const changeEmail = async () => {
    const next = newEmail.trim();
    if (!next || next === email) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      toast("נשלח אימייל אימות לכתובת החדשה ✓", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "שינוי האימייל נכשל", "error");
    }
  };

  const initial = (form.full_name || form.company || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="container-app py-8">
      <p className="eyebrow mb-1.5">החשבון שלך</p>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-navy-dark">הפרופיל שלי</h1>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── Identity card ── */}
        <div className="space-y-6">
          <div className="card p-6 text-center">
            <div className="relative mx-auto h-28 w-28">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-28 w-28 rounded-full object-cover ring-2 ring-gold/40 shadow-gold" />
              ) : (
                <div className="grid h-28 w-28 place-items-center rounded-full bg-onyx-gradient text-4xl font-extrabold text-gradient-gold ring-2 ring-gold/40">
                  {initial}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="שנה תמונה"
                className="absolute bottom-0 left-0 grid h-9 w-9 place-items-center rounded-full bg-gold-gradient text-navy-dark shadow-gold ring-2 ring-white"
              >
                {uploading ? "…" : "✎"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickAvatar(f); }} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-navy-dark">{form.company || form.full_name || "—"}</h2>
            <p className="truncate text-sm text-slate-500">{email}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <span className="badge bg-gold/10 text-gold-dark ring-1 ring-gold/30">{ROLE_HE[profile?.role ?? ""] ?? profile?.role}</span>
              {profile?.status && (
                <span className={`badge ${profile.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {PROFILE_STATUS_HE[profile.status]}
                </span>
              )}
            </div>
          </div>

          {/* Account details (read-only) */}
          <div className="card p-5">
            <h3 className="mb-3 font-bold text-navy-dark">פרטי חשבון</h3>
            <dl className="space-y-2.5 text-sm">
              <Row label="שם משתמש" value={profile?.username || "—"} mono />
              <Row label="סוג לקוח" value={CUSTOMER_TYPE_HE[profile?.customer_type ?? ""] ?? "—"} />
              <Row label="תנאי תשלום" value={PAYMENT_TERMS_HE[profile?.payment_terms ?? ""] ?? "—"} />
              <Row label="מסגרת אשראי" value={profile ? formatPrice(profile.credit_limit) : "—"} />
              <Row label="הזמנות" value={String(orders)} />
              <Row label="חבר מאז" value={profile ? new Date(profile.created_at).toLocaleDateString("he-IL") : "—"} />
            </dl>
          </div>

          {/* Shortcuts */}
          <div className="card divide-y divide-slate-100">
            <Link href="/account/security" className="flex items-center justify-between p-4 text-sm font-medium text-slate-700 hover:bg-gold-50">
              <span>🔒 אבטחה, טביעת אצבע והתראות</span><span className="text-slate-300">←</span>
            </Link>
            <Link href="/account/orders" className="flex items-center justify-between p-4 text-sm font-medium text-slate-700 hover:bg-gold-50">
              <span>📦 ההזמנות שלי</span><span className="text-slate-300">←</span>
            </Link>
          </div>
        </div>

        {/* ── Editable forms ── */}
        <div className="space-y-6">
          {/* Personal info */}
          <section className="card p-6">
            <h3 className="mb-4 font-bold text-navy-dark">פרטים אישיים</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="שם מלא" value={form.full_name} onChange={(v) => set("full_name", v)} />
              <Field label="שם העסק" value={form.company} onChange={(v) => set("company", v)} />
              <Field label="טלפון" value={form.phone} onChange={(v) => set("phone", v)} dir="ltr" />
              <Field label="עיר" value={form.city} onChange={(v) => set("city", v)} />
              <div className="sm:col-span-2">
                <Field label="כתובת" value={form.address} onChange={(v) => set("address", v)} />
              </div>
              {isAdmin && (
                <Field label="שם משתמש (כניסה)" value={username} onChange={setUsername} dir="ltr" hint="לאדמין בלבד" />
              )}
            </div>
            <button onClick={saveInfo} disabled={saving} className="btn-gold mt-5">
              {saving ? "שומר…" : "שמירת שינויים"}
            </button>
          </section>

          {/* Change password */}
          <section className="card p-6">
            <h3 className="mb-4 font-bold text-navy-dark">שינוי סיסמה</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="סיסמה חדשה" type="password" value={pw.next} onChange={(v) => setPw((p) => ({ ...p, next: v }))} dir="ltr" />
              <Field label="אימות סיסמה" type="password" value={pw.confirm} onChange={(v) => setPw((p) => ({ ...p, confirm: v }))} dir="ltr" />
            </div>
            <button onClick={changePassword} disabled={savingPw} className="btn-primary mt-5">
              {savingPw ? "מעדכן…" : "עדכן סיסמה"}
            </button>
          </section>

          {/* Admin-only: change email */}
          {isAdmin && (
            <section className="card p-6">
              <h3 className="mb-1 font-bold text-navy-dark">שינוי אימייל</h3>
              <p className="mb-4 text-xs text-slate-400">לאדמין בלבד · יישלח אימייל אימות לכתובת החדשה.</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <Field label="כתובת אימייל" type="email" value={newEmail} onChange={setNewEmail} dir="ltr" />
                </div>
                <button onClick={changeEmail} className="btn-outline">עדכן אימייל</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-semibold text-navy-dark ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", dir, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; dir?: "ltr" | "rtl"; hint?: string;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {hint && <span className="mr-1 text-xs font-normal text-gold-dark">· {hint}</span>}
      </label>
      <input
        type={type}
        dir={dir}
        className={`input ${dir === "ltr" ? "ltr-input" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
