"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import {
  isPlatformAuthenticatorAvailable,
  hasLocalPasskeyHint,
  registerPasskey,
  removePasskey,
} from "@/lib/passkey";
import { isPushSupported, isSubscribed, enablePush, disablePush, sendTestPush } from "@/lib/push";
import { createClient } from "@/lib/supabase/client";

export default function SecurityPage() {
  const router = useRouter();
  const { ready, userId } = useProfile();
  const toast = useToast();

  const [supported, setSupported]   = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [working, setWorking]       = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!userId) { router.replace("/"); return; }
    isPlatformAuthenticatorAvailable().then(setSupported);
    // Check DB for actual stored credential
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("passkey_credential_id")
      .eq("id", userId)
      .single()
      .then(({ data }) => setHasPasskey(!!data?.passkey_credential_id));
  }, [ready, userId, router]);

  const handleRegister = async () => {
    setWorking(true);
    try {
      await registerPasskey();
      setHasPasskey(true);
      toast("טביעת האצבע נרשמה בהצלחה ✓");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("cancel") && !msg.includes("NotAllowedError")) {
        toast(msg || "הרישום נכשל", "error");
      }
    } finally {
      setWorking(false);
    }
  };

  const handleRemove = async () => {
    setWorking(true);
    try {
      await removePasskey();
      setHasPasskey(false);
      toast("טביעת האצבע הוסרה");
    } catch {
      toast("ההסרה נכשלה", "error");
    } finally {
      setWorking(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="container-app py-8">
      <p className="eyebrow mb-1.5">פרטיות והגנה</p>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-navy-dark">אבטחת חשבון</h1>

      <div className="card max-w-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand">
            <FingerprintIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold">כניסה עם טביעת אצבע / Face ID</p>
            <p className="text-sm text-slate-500">
              התחברו מהר וללא סיסמה באמצעות הביומטריה של המכשיר שלכם
            </p>
          </div>
        </div>

        {!supported ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            המכשיר הנוכחי אינו תומך בכניסה ביומטרית.
          </p>
        ) : hasPasskey ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <span className="text-lg">✓</span>
              טביעת אצבע רשומה ופעילה על המכשיר הזה
            </div>
            <p className="text-sm text-slate-500">
              רצונכם להסיר ולרשום מחדש? לחצו על הסרה ואז חזרו לרשום שוב.
            </p>
            <button
              onClick={handleRemove}
              disabled={working}
              className="btn border border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              {working ? "מסיר…" : "הסר טביעת אצבע"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              לא נרשמה טביעת אצבע למכשיר זה. לחצו להפעלה — המכשיר יבקש אישור ביומטרי.
            </p>
            <button
              onClick={handleRegister}
              disabled={working}
              className="btn-primary flex items-center gap-2"
            >
              <FingerprintIcon className="h-4 w-4" />
              {working ? "ממתין לאישור…" : "הפעל כניסה עם טביעת אצבע"}
            </button>
          </div>
        )}

        {hasLocalPasskeyHint() && !hasPasskey && (
          <p className="text-xs text-slate-400">
            שים לב: כניסה ביומטרית קיימת ב localStorage אך לא בשרת. יש לרשום מחדש.
          </p>
        )}
      </div>

      <PushSection />
    </div>
  );
}

// ── Web Push notifications ────────────────────────────────────────────────────
function PushSection() {
  const toast = useToast();
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setSupported(isPushSupported());
    isSubscribed().then(setOn);
  }, []);

  if (!supported) return null;

  const toggle = async () => {
    setWorking(true);
    try {
      if (on) {
        await disablePush();
        setOn(false);
        toast("ההתראות בוטלו");
      } else {
        await enablePush();
        setOn(true);
        toast("התראות הופעלו ✓");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "פעולה נכשלה", "error");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="card mt-5 max-w-lg p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand text-xl">🔔</div>
        <div>
          <p className="font-semibold">התראות בדחיפה (Push)</p>
          <p className="text-sm text-slate-500">קבלו התראה מיידית על הזמנות חדשות ועדכונים — גם כשהאתר סגור.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={toggle}
          disabled={working}
          className={`btn ${on ? "border border-rose-200 text-rose-600 hover:bg-rose-50" : "btn-primary"} flex items-center gap-2`}
        >
          {working ? "רגע…" : on ? "כבה התראות במכשיר זה" : "הפעל התראות במכשיר זה"}
        </button>
        {on && (
          <button
            onClick={async () => {
              try {
                const r = await sendTestPush();
                toast(r.sent > 0 ? "נשלחה התראת בדיקה ✓" : "אין מנויים פעילים", r.sent > 0 ? "success" : "info");
              } catch (err) {
                toast(err instanceof Error ? err.message : "השליחה נכשלה", "error");
              }
            }}
            className="btn-outline text-sm"
          >
            שלח התראת בדיקה
          </button>
        )}
      </div>
    </div>
  );
}

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
