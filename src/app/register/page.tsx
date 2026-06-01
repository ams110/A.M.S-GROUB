"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const supabase = createClient();
  const [form, setForm] = useState({
    full_name: "",
    company: "",
    phone: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          company: form.company,
          phone: form.phone,
        },
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="container-app flex justify-center py-16">
        <div className="card w-full max-w-md p-8 text-center">
          <p className="text-3xl">✅</p>
          <h1 className="mt-3 text-xl font-bold">ההרשמה נקלטה!</h1>
          <p className="mt-2 text-sm text-slate-600">
            החשבון שלכם ממתין לאישור היבואן. נעדכן אתכם במייל לאחר האישור, ואז
            תוכלו לראות מחירים ולבצע הזמנות.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-bold">הרשמת סוחר חדש</h1>
        <p className="mb-6 text-sm text-slate-500">
          ההרשמה מיועדת לבעלי עסקים. החשבון יופעל לאחר אישור היבואן.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">שם איש קשר *</label>
            <input
              required
              className="input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">שם העסק / חברה</label>
            <input
              className="input"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>
          <div>
            <label className="label">טלפון *</label>
            <input
              required
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">אימייל *</label>
            <input
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">סיסמה *</label>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && (
            <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? "שולח…" : "הרשמה"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          כבר רשומים?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            כניסה
          </Link>
        </p>
      </div>
    </div>
  );
}
