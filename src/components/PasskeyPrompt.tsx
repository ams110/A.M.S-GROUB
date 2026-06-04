"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import {
  isPlatformAuthenticatorAvailable,
  hasLocalPasskeyHint,
  registerPasskey,
} from "@/lib/passkey";

const DISMISS_KEY = "ams_passkey_prompt_dismissed";

/**
 * Bank-style "enable fingerprint login" prompt.
 *
 * Shown once, after the user is logged in, when:
 *  - the device has a platform authenticator (fingerprint / Face ID), AND
 *  - no passkey is registered for this device yet, AND
 *  - the user hasn't dismissed the prompt before.
 *
 * Rendered globally from AuthGuard so it appears right after login on any page.
 */
export default function PasskeyPrompt() {
  const { ready, userId } = useProfile();
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!ready || !userId) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (hasLocalPasskeyHint()) return; // already enrolled on this device

    let cancelled = false;
    (async () => {
      const supported = await isPlatformAuthenticatorAvailable();
      if (cancelled || !supported) return;

      // Confirm the account doesn't already have a server-side credential.
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("passkey_credential_id")
        .eq("id", userId)
        .single();
      if (cancelled) return;
      if (data?.passkey_credential_id) {
        // Enrolled elsewhere already — don't nag, but remember locally.
        return;
      }
      // Small delay so it doesn't fight the welcome screen / first paint.
      setTimeout(() => !cancelled && setShow(true), 1200);
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, userId]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  const enable = async () => {
    setWorking(true);
    try {
      await registerPasskey();
      toast("הכניסה בטביעת אצבע הופעלה ✓");
      localStorage.setItem(DISMISS_KEY, "1");
      setShow(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("cancel") && !msg.includes("NotAllowedError")) {
        toast(msg || "ההפעלה נכשלה", "error");
      }
      // If the user cancelled the biometric sheet, keep the prompt so they can retry.
    } finally {
      setWorking(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] print:hidden md:bottom-6 md:left-auto md:right-6 md:px-0">
      <div className="mx-auto max-w-md animate-slide-down overflow-hidden rounded-3xl bg-onyx-gradient p-5 shadow-onyx ring-1 ring-gold/20 md:mx-0">
        <span className="absolute inset-x-0 top-0 h-px hairline-gold" />
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold">
            <FingerprintIcon className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white">כניסה מהירה בטביעת אצבע</p>
            <p className="mt-0.5 text-sm text-white/55">
              הפעילו כניסה ביומטרית במכשיר הזה — בפעם הבאה תיכנסו בלי סיסמה, ישירות ממסך הכניסה.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={enable}
                disabled={working}
                className="rounded-xl bg-gold-gradient px-4 py-2 text-sm font-bold text-navy-dark shadow-gold disabled:opacity-60"
              >
                {working ? "ממתין לאישור…" : "הפעלה"}
              </button>
              <button onClick={dismiss} className="rounded-xl px-3 py-2 text-sm font-medium text-white/50 hover:text-white/80">
                לא עכשיו
              </button>
            </div>
          </div>
          <button onClick={dismiss} aria-label="סגור" className="shrink-0 text-white/40 hover:text-white">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function FingerprintIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </svg>
  );
}
