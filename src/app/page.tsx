"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import {
  isPlatformAuthenticatorAvailable,
  hasLocalPasskeyHint,
  authenticateWithPasskey,
} from "@/lib/passkey";

// ── Fingerprint icon ─────────────────────────────────────────────────────────
function FingerprintIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M2 17c1 .5 2.28.86 3 1" />
      <path d="M20 12c.28 2.87-.36 5.42-1.06 7" />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </svg>
  );
}

// ── Login form ────────────────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "";
  const { email: sessionEmail, profile, ready } = useProfile();

  const [emailInput, setEmailInput]   = useState("");
  const [password, setPassword]       = useState("");
  const [formError, setFormError]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyLoading, setPasskeyLoading]     = useState(false);

  // Already logged in → redirect immediately
  useEffect(() => {
    if (!ready) return;
    if (sessionEmail) {
      router.replace(
        profile?.role === "admin" || profile?.role === "super_admin"
          ? "/admin"
          : "/products"
      );
    }
  }, [ready, sessionEmail, profile, router]);

  // Check passkey availability (only show button if device + hint match)
  useEffect(() => {
    if (!hasLocalPasskeyHint()) return;
    isPlatformAuthenticatorAvailable().then(setPasskeyAvailable);
  }, []);

  if (!ready || sessionEmail) return null;

  const supabase = createClient();

  const handlePasskey = async () => {
    setFormError(null);
    setPasskeyLoading(true);
    try {
      await authenticateWithPasskey();
      router.push("/welcome");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("cancel") || msg.includes("NotAllowedError")) {
        // User cancelled — silent
      } else {
        setFormError("הכניסה בטביעת האצבע נכשלה. נסו עם הסיסמה.");
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      let email = emailInput.trim();

      // If no @ — treat as username and resolve to email via DB function
      if (!email.includes("@")) {
        const { data: resolved } = await supabase.rpc("get_email_by_username", {
          uname: email,
        });
        if (!resolved) {
          setFormError("שם משתמש או אימייל לא נמצאו.");
          setLoading(false);
          return;
        }
        email = resolved as string;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setFormError(
          /invalid login|credentials/i.test(error.message)
            ? "אימייל / שם משתמש או סיסמה שגויים."
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

      router.push("/welcome");
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

        {/* Passkey button — only shown when device has a registered passkey */}
        {passkeyAvailable && (
          <button
            onClick={handlePasskey}
            disabled={passkeyLoading}
            className="btn mb-5 w-full gap-3 border border-brand/30 bg-brand-light text-brand hover:bg-brand hover:text-white"
          >
            <FingerprintIcon className="h-5 w-5" />
            {passkeyLoading ? "מאמת…" : "כניסה עם טביעת אצבע"}
          </button>
        )}

        {passkeyAvailable && (
          <div className="mb-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="flex-1 border-t border-slate-200" />
            <span>או</span>
            <span className="flex-1 border-t border-slate-200" />
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">אימייל / שם משתמש</label>
            <input
              type="text"
              required
              autoComplete="username email"
              className="input ltr-input"
              dir="ltr"
              placeholder="user@example.com או username"
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
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center text-slate-400">
          טוען…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
