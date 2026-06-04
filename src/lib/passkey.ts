"use client";

import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

const FN_BASE = `${SUPABASE_URL}/functions/v1`;
const PASSKEY_KEY = "ams_passkey_registered";

/** True if this browser/device supports platform passkeys (fingerprint/face). */
export function isPasskeySupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
      "function"
  );
}

/** Non-blocking check — resolves to true if a platform authenticator is available. */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Returns true if this device has a passkey registered (localStorage hint). */
export function hasLocalPasskeyHint(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PASSKEY_KEY) === "1";
}

function setLocalPasskeyHint(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(PASSKEY_KEY, "1");
  else localStorage.removeItem(PASSKEY_KEY);
}

export type PasskeyInfo = {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
};

/** A short human label for the current device, e.g. "Chrome · Android". */
function deviceLabel(): string {
  if (typeof navigator === "undefined") return "מכשיר";
  const ua = navigator.userAgent;
  const os =
    /iPhone|iPad|iPod/.test(ua) ? "iPhone/iPad"
    : /Android/.test(ua) ? "Android"
    : /Mac/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows"
    : "מכשיר";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "";
  return browser ? `${browser} · ${os}` : os;
}

/** Returns the caller's registered passkeys (one row per device). */
export async function listPasskeys(): Promise<PasskeyInfo[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_passkeys");
  if (error) throw new Error(error.message);
  return (data as PasskeyInfo[]) ?? [];
}

/** Call this after the user logs in with a password to register their passkey. */
export async function registerPasskey(): Promise<void> {
  const supabase = createClient();
  let {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not logged in");

  // On the static export there is no middleware refreshing the cookie, so the
  // access token can be stale by the time the user taps "register". Refresh it
  // when it is expired or about to expire, otherwise the Edge Function's
  // getUser() rejects it with "unauthorized".
  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (!expiresAtMs || expiresAtMs < Date.now() + 60_000) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) session = data.session;
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
  };

  // 1. Get registration options from Edge Function
  const startRes = await fetch(`${FN_BASE}/passkey-register`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "start" }),
  });
  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to start registration");
  }
  const { options } = await startRes.json();

  // 2. Browser prompts for biometric — throws if user cancels
  const credential = await startRegistration(options);

  // 3. Verify & store on server
  const finishRes = await fetch(`${FN_BASE}/passkey-register`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "finish", credential, label: deviceLabel() }),
  });
  if (!finishRes.ok) {
    const err = await finishRes.json().catch(() => ({}));
    // Surface the server's detail (message) when present so failures are
    // diagnosable instead of a generic "registration failed".
    throw new Error(err.message || err.error || "Failed to complete registration");
  }

  setLocalPasskeyHint(true);
}

/** Sign in using a registered passkey — browser will prompt for biometric. */
export async function authenticateWithPasskey(): Promise<void> {
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  };

  // 1. Get authentication options
  const startRes = await fetch(`${FN_BASE}/passkey-auth`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "start" }),
  });
  if (!startRes.ok) throw new Error("Failed to start authentication");
  const { options } = await startRes.json();

  // 2. Browser prompts for biometric — throws if user cancels
  const credential = await startAuthentication(options);

  // 3. Verify on server — returns email + OTP token
  const finishRes = await fetch(`${FN_BASE}/passkey-auth`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "finish", credential }),
  });
  if (!finishRes.ok) {
    const err = await finishRes.json().catch(() => ({}));
    throw new Error(err.error ?? "Authentication failed");
  }
  const { email, token } = await finishRes.json();

  // 4. Complete sign-in using the one-time email OTP returned by the server
  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw new Error(error.message);
}

/** Remove one registered passkey (by its row id). */
export async function removePasskey(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_passkey", { p_id: id });
  if (error) throw new Error(error.message);
}
