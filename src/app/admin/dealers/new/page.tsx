"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { BASE_PATH } from "@/lib/config";
import { genPassword, waLink, welcomeMessage } from "@/lib/onboarding";
import { PAYMENT_TERMS_HE } from "@/lib/format";
import type { CustomerType, PaymentTerms } from "@/lib/types";

type Form = {
  customer_type: CustomerType;
  full_name: string;
  company: string;
  phone: string;
  email: string;
  username: string;
  password: string;
  credit_limit: number;
  payment_terms: PaymentTerms;
};

const EMPTY: Form = {
  customer_type: "dealer",
  full_name: "",
  company: "",
  phone: "",
  email: "",
  username: "",
  password: genPassword(),
  credit_limit: 0,
  payment_terms: "immediate",
};

const STEPS = ["סוג", "פרטים", "תנאים", "סיום"];

export default function NewDealerWizard() {
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();

  const [step, setStep] = useState(0); // 0..2 wizard, 3 = success
  const [form, setForm] = useState<Form>({ ...EMPTY });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    name: string;
    phone: string;
    loginUrl: string;
    login: string;
    password: string;
  } | null>(null);

  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim());
  const canNext0 = !!form.customer_type;
  const canNext1 = emailOk;
  const canCreate = emailOk && form.password.length >= 6;

  const loginUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://ams-groub.linko.services";
    return `${window.location.origin}${BASE_PATH}/`;
  }, []);

  const create = async () => {
    setError(null);
    if (!canCreate) {
      setError("נא להזין אימייל תקין וסיסמה (לפחות 6 תווים).");
      return;
    }
    setCreating(true);
    const { data, error: fnErr } = await supabase.functions.invoke("admin-create-customer", {
      body: {
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        company: form.company.trim(),
        phone: form.phone.trim(),
        customer_type: form.customer_type,
      },
    });

    if (fnErr || data?.error) {
      const msg = data?.message || data?.error || fnErr?.message || "";
      setError(
        /already.*registered|exists/i.test(msg)
          ? "האימייל כבר רשום במערכת."
          : `יצירת החשבון נכשלה: ${msg}`
      );
      setCreating(false);
      return;
    }

    // The Edge Function only sets the core fields; persist the rest of the
    // initial setup (username + credit terms) here so the admin never has to
    // dig into the customers table afterwards.
    const id = data.id as string;
    const patch: Record<string, unknown> = {};
    const uname = form.username.trim().toLowerCase();
    if (uname) patch.username = uname;
    if (form.customer_type === "dealer") {
      patch.credit_limit = form.credit_limit;
      patch.payment_terms = form.payment_terms;
    }
    if (Object.keys(patch).length) {
      const { error: upErr } = await supabase.from("profiles").update(patch).eq("id", id);
      if (upErr && /unique/i.test(upErr.message)) {
        toast("החשבון נוצר, אך שם המשתמש כבר תפוס — לא נשמר", "error");
      }
    }

    setCreating(false);
    setDone({
      name: form.full_name.trim() || form.company.trim(),
      phone: form.phone.trim(),
      loginUrl,
      login: uname || form.email.trim(),
      password: form.password,
    });
    setStep(3);
    toast("החשבון נוצר בהצלחה 🎉");
  };

  /* ───────────────────────── Success screen ───────────────────────── */
  if (step === 3 && done) {
    const msg = welcomeMessage({
      name: done.name,
      loginUrl: done.loginUrl,
      login: done.login,
      password: done.password,
    });
    const hasPhone = done.phone.replace(/\D/g, "").length >= 9;

    return (
      <div className="mx-auto max-w-xl animate-fade-in">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-l from-emerald-500 to-emerald-600 px-6 py-8 text-center text-white">
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-white/20 text-4xl">
              ✓
            </div>
            <h2 className="text-xl font-extrabold">החשבון מוכן!</h2>
            <p className="mt-1 text-sm text-white/90">
              נותר רק לשלוח ל{done.name || "לקוח"} את פרטי הכניסה.
            </p>
          </div>

          <div className="space-y-4 p-6">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <CredRow label="כתובת כניסה" value={done.loginUrl} mono />
              <CredRow label="שם משתמש" value={done.login} mono />
              <CredRow label="סיסמה" value={done.password} mono />
            </div>

            <button
              onClick={() => {
                navigator.clipboard?.writeText(msg);
                toast("ההודעה הועתקה");
              }}
              className="btn-outline w-full"
            >
              📋 העתקת ההודעה
            </button>

            {hasPhone ? (
              <a
                href={waLink(done.phone, msg)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 font-bold text-white shadow-sm transition hover:brightness-95"
              >
                <WhatsAppIcon />
                שליחת פרטי הכניסה בוואטסאפ
              </a>
            ) : (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-700">
                לא הוזן טלפון — העתיקו את ההודעה ושלחו ידנית.
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setForm({ ...EMPTY, password: genPassword() });
                  setDone(null);
                  setStep(0);
                }}
                className="btn-outline flex-1"
              >
                + לקוח נוסף
              </button>
              <Link href="/admin/dealers" className="btn-primary flex-1 text-center">
                סיום
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───────────────────────── Wizard ───────────────────────── */
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold">הוספת לקוח חדש</h2>
        <Link href="/admin/dealers" className="text-sm text-brand hover:underline">
          ← לרשימת הלקוחות
        </Link>
      </div>

      {/* Stepper */}
      <div className="mb-6 flex items-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition-all ${
                  i < step
                    ? "bg-emerald-500 text-white"
                    : i === step
                    ? "bg-gold-gradient text-navy-dark shadow-gold"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className={`mt-1 text-[11px] ${
                  i === step ? "font-semibold text-navy-dark" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-1 h-0.5 flex-1 rounded ${
                  i < step ? "bg-emerald-400" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="card animate-fade-in p-6">
        {/* Step 0 — account type */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">איזה סוג לקוח נפתח?</p>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  { v: "dealer", t: "סוחר", d: "מחיר סיטונאי, מסגרת אשראי ותנאי תשלום", icon: "🏪" },
                  { v: "contractor", t: "קבלן", d: "מחיר קבלן מותאם לפרויקטים", icon: "👷" },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  onClick={() => set({ customer_type: o.v })}
                  className={`rounded-2xl border-2 p-5 text-center transition-all ${
                    form.customer_type === o.v
                      ? "border-gold bg-gold-50 shadow-gold"
                      : "border-slate-200 hover:border-gold/40 hover:bg-gold-50/40"
                  }`}
                >
                  <div className="text-3xl">{o.icon}</div>
                  <div className="mt-2 font-bold text-navy-dark">{o.t}</div>
                  <div className="mt-1 text-xs text-slate-500">{o.d}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 — details */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">שם איש קשר</label>
                <input
                  className="input"
                  value={form.full_name}
                  onChange={(e) => set({ full_name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">חברה / עסק</label>
                <input
                  className="input"
                  value={form.company}
                  onChange={(e) => set({ company: e.target.value })}
                />
              </div>
              <div>
                <label className="label">טלפון (לוואטסאפ)</label>
                <input
                  className="input ltr-input"
                  dir="ltr"
                  placeholder="050-0000000"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">אימייל *</label>
                <input
                  type="email"
                  className="input ltr-input"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                />
                {!emailOk && form.email && (
                  <p className="mt-1 text-xs text-rose-600">אימייל לא תקין</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — terms & credentials */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">שם משתמש (לכניסה מהירה)</label>
                <input
                  className="input ltr-input"
                  dir="ltr"
                  placeholder="לא חובה"
                  value={form.username}
                  onChange={(e) => set({ username: e.target.value })}
                />
              </div>
              <div>
                <label className="label">סיסמה *</label>
                <div className="flex gap-2">
                  <input
                    className="input ltr-input flex-1"
                    dir="ltr"
                    value={form.password}
                    onChange={(e) => set({ password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => set({ password: genPassword() })}
                    className="btn-outline shrink-0 px-3"
                    title="יצירת סיסמה"
                  >
                    🎲
                  </button>
                </div>
                {form.password.length < 6 && (
                  <p className="mt-1 text-xs text-rose-600">לפחות 6 תווים</p>
                )}
              </div>
            </div>

            {form.customer_type === "dealer" && (
              <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:grid-cols-2">
                <div>
                  <label className="label">מסגרת אשראי (₪)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.credit_limit}
                    onChange={(e) => set({ credit_limit: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">תנאי תשלום</label>
                  <select
                    className="input"
                    value={form.payment_terms}
                    onChange={(e) => set({ payment_terms: e.target.value as PaymentTerms })}
                  >
                    {(Object.keys(PAYMENT_TERMS_HE) as PaymentTerms[]).map((k) => (
                      <option key={k} value={k}>
                        {PAYMENT_TERMS_HE[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={() => (step === 0 ? router.push("/admin/dealers") : setStep((s) => s - 1))}
            className="btn-outline"
            disabled={creating}
          >
            {step === 0 ? "ביטול" : "→ הקודם"}
          </button>

          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={(step === 0 && !canNext0) || (step === 1 && !canNext1)}
              className="btn-primary"
            >
              הבא ←
            </button>
          ) : (
            <button
              type="button"
              onClick={create}
              disabled={creating || !canCreate}
              className="btn-primary"
            >
              {creating ? "יוצר…" : "✓ יצירת חשבון"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CredRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const toast = useToast();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 py-2 last:border-0">
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(value);
          toast("הועתק");
        }}
        className={`truncate text-sm text-navy-dark hover:text-brand ${mono ? "ltr-input" : ""}`}
        dir={mono ? "ltr" : undefined}
        title="העתקה"
      >
        {value}
      </button>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.523 5.26l-.999 3.648 3.965-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
    </svg>
  );
}
