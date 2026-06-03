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
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(
          /invalid login|credentials/i.test(error.message)
            ? "אימייל או סיסמה שגויים."
            : /confirm/i.test(error.message)
            ? "החשבון טרם אומת. פנו למנהל המערכת."
            : `שגיאת התחברות: ${error.message}`
        );
        return;
      }

      // Admins land in the management area; others go to the requested page.
      let dest = redirect;
      const uid = data.user?.id;
      if (uid && redirect === "/") {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .single();
        if (prof?.role === "admin") dest = "/admin";
      }
      router.push(dest);
      router.refresh();
    } catch (err) {
      // Network / CORS / unexpected — surface it instead of hanging.
      setError(
        `לא ניתן להתחבר כעת. בדקו את החיבור לאינטרנט ונסו שוב. (${
          err instanceof Error ? err.message : String(err)
        })`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-app flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-bold">כניסה לפורטל</h1>
        <p className="mb-6 text-sm text-slate-500">התחברו לחשבון הסוחר שלכם.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">אימייל</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input ltr-input"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">סיסמה</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input ltr-input"
              dir="ltr"
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
          פתיחת חשבון חדש — פנו לצוות A.M.S GROUP.
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
