"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { WizardStepper, CheckIcon } from "@/components/WizardStepper";
import { RefreshIcon, StoreIcon, HelmetIcon, WhatsAppIcon } from "@/components/icons";
import { ReviewCard, ReviewItem } from "@/components/ReviewSummary";
import Confetti from "@/components/Confetti";
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

  const [qr, setQr] = useState<string>("");

  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  // On success: render a QR for the login URL + a celebratory haptic buzz.
  useEffect(() => {
    if (step === 3 && done) {
      QRCode.toDataURL(done.loginUrl, { margin: 1, width: 220 })
        .then(setQr)
        .catch(() => setQr(""));
      navigator.vibrate?.([18, 40, 18]);
    }
  }, [step, done]);

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
    const allCreds = `${done.loginUrl}\n${done.login}\n${done.password}`;

    return (
      <div className="mx-auto max-w-xl animate-fade-up">
        <Confetti />
        <div className="card overflow-hidden">
          {/* Golden hero */}
          <div className="relative overflow-hidden bg-gold-gradient px-6 py-9 text-center text-navy-dark">
            <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(120px_60px_at_20%_0%,#fff,transparent),radial-gradient(160px_80px_at_90%_120%,#fff,transparent)]" />
            <div className="animate-pop-in mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-navy-dark/10 text-4xl shadow-gold ring-4 ring-white/30">
              <CheckIcon />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">החשבון מוכן! 🎉</h2>
            <p className="mt-1 text-sm font-medium text-navy-dark/75">
              נותר רק לשלוח ל{done.name || "לקוח"} את פרטי הכניסה.
            </p>
          </div>

          <div className="space-y-4 p-6">
            {/* Credentials + QR */}
            <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="min-w-0 flex-1">
                <CredRow label="כתובת כניסה" value={done.loginUrl} mono />
                <CredRow label="שם משתמש" value={done.login} mono />
                <CredRow label="סיסמה" value={done.password} mono />
              </div>
              {qr && (
                <div className="shrink-0 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qr}
                    alt="QR לכניסה"
                    className="h-24 w-24 rounded-lg bg-white p-1 ring-1 ring-slate-200"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">סריקה לכניסה</p>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                navigator.clipboard?.writeText(allCreds);
                toast("כל הפרטים הועתקו");
              }}
              className="btn-outline w-full"
            >
              📋 העתקת כל הפרטים
            </button>

            {/* WhatsApp message preview */}
            <div>
              <p className="eyebrow mb-2">תצוגה מקדימה של ההודעה</p>
              <div className="relative rounded-2xl rounded-tr-sm border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-relaxed text-slate-700">
                <span className="whitespace-pre-line">{msg}</span>
              </div>
            </div>

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
              <Link href="/admin/dealers" className="btn-gold flex-1 text-center">
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

      {/* Glowing stepper */}
      <WizardStepper steps={STEPS} current={step} />

      <div key={step} className="card animate-fade-up p-6">
        {/* Step 0 — account type */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">איזה סוג לקוח נפתח?</p>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  { v: "dealer", t: "סוחר", d: "מחיר סיטונאי, מסגרת אשראי ותנאי תשלום", icon: <StoreIcon /> },
                  { v: "contractor", t: "קבלן", d: "מחיר קבלן מותאם לפרויקטים", icon: <HelmetIcon /> },
                ] as const
              ).map((o) => {
                const active = form.customer_type === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => set({ customer_type: o.v })}
                    className={`group relative rounded-2xl border p-5 text-center backdrop-blur transition-all duration-200 hover:-translate-y-0.5 ${
                      active
                        ? "border-gold bg-gold-50 shadow-gold ring-1 ring-gold/40"
                        : "border-white/10 bg-white/[0.04] hover:border-gold/40 hover:bg-gold-50/40"
                    }`}
                  >
                    {active && (
                      <span className="animate-pop-in absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-gold-gradient text-navy-dark shadow-gold">
                        <CheckIcon size={14} />
                      </span>
                    )}
                    <div className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl transition-colors ${active ? "text-gold-dark" : "text-slate-400 group-hover:text-gold-dark"}`}>
                      {o.icon}
                    </div>
                    <div className="mt-2 font-bold text-navy-dark">{o.t}</div>
                    <div className="mt-1 text-xs text-slate-500">{o.d}</div>
                  </button>
                );
              })}
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
                    <RefreshIcon />
                  </button>
                </div>
                <PasswordStrength value={form.password} />
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

            {/* Review summary — what's about to be created */}
            <ReviewCard title="סיכום לפני יצירה">
              <ReviewItem label="סוג" value={form.customer_type === "dealer" ? "סוחר" : "קבלן"} />
              <ReviewItem label="שם" value={form.full_name || form.company || "—"} />
              <ReviewItem label="אימייל" value={form.email || "—"} mono />
              <ReviewItem label="טלפון" value={form.phone || "—"} mono />
              {form.customer_type === "dealer" && (
                <>
                  <ReviewItem label="מסגרת אשראי" value={`₪${form.credit_limit.toLocaleString()}`} />
                  <ReviewItem label="תנאי תשלום" value={PAYMENT_TERMS_HE[form.payment_terms]} />
                </>
              )}
            </ReviewCard>

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
              className="btn-gold"
            >
              הבא ←
            </button>
          ) : (
            <button
              type="button"
              onClick={create}
              disabled={creating || !canCreate}
              className="btn-gold"
            >
              {creating ? "יוצר…" : "✓ יצירת חשבון"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

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

/** Password strength meter (length + character variety → 0..4). */
function PasswordStrength({ value }: { value: string }) {
  const score = useMemo(() => {
    let s = 0;
    if (value.length >= 6) s++;
    if (value.length >= 10) s++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) s++;
    if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) s++;
    return Math.min(s, 4);
  }, [value]);

  if (value.length < 6) {
    return <p className="mt-1 text-xs text-rose-600">לפחות 6 תווים</p>;
  }
  const labels = ["חלשה", "בינונית", "טובה", "חזקה מאוד"];
  const colors = ["bg-rose-400", "bg-amber-400", "bg-lime-400", "bg-emerald-500"];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < score ? colors[score - 1] : "bg-white/12"
            }`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">חוזק סיסמה: {labels[Math.max(0, score - 1)]}</p>
    </div>
  );
}

