"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "";
  const { email: sessionEmail, profile, ready } = useProfile();

  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already logged in → redirect immediately, don't show the form.
  useEffect(() => {
    if (!ready) return;
    if (sessionEmail) {
      router.replace(profile?.role === "admin" ? "/admin" : "/products");
    }
  }, [ready, sessionEmail, profile, router]);

  if (!ready || sessionEmail) return null;

  const supabase = createClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password,
      });
      if (error) {
        setFormError(
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
      setFormError(
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
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
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
          {formError && (
            <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
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
