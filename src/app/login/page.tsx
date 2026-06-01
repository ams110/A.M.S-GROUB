"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/";
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("אימייל או סיסמה שגויים.");
      return;
    }
    router.push(redirect);
    router.refresh();
  };

  return (
    <div className="container-app flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-bold">כניסת סוחרים</h1>
        <p className="mb-6 text-sm text-slate-500">התחברו לחשבון הסוחר שלכם.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">אימייל</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">סיסמה</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? "מתחבר…" : "כניסה"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          אין לכם חשבון?{" "}
          <Link href="/register" className="font-semibold text-brand hover:underline">
            הרשמת סוחר חדש
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-app py-16 text-center">טוען…</div>}>
      <LoginForm />
    </Suspense>
  );
}
