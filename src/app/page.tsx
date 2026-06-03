"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "";
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

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
        return;
      }

      const uid = data.user?.id;
      let dest = "/products";
      if (uid) {
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
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.svg`}
            alt="Â.M.Ŝ GROUP"
            className="h-20 w-20 rounded-2xl shadow-md"
          />
        </div>
        <h1 className="mb-1 text-center text-2xl font-bold">Â.M.Ŝ GROUP</h1>
        <p className="mb-6 text-center text-sm text-slate-500">פורטל הזמנות סיטונאי</p>
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
          פתיחת חשבון חדש — פנו לצוות Â.M.Ŝ GROUP.
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-8rem)] items-center justify-center text-slate-400">טוען…</div>}>
      <LoginForm />
    </Suspense>
  );
}
