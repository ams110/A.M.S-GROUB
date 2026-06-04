"use client";

import { BASE_PATH, VAPID_PUBLIC_KEY } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

/** True if this browser supports Web Push (service worker + PushManager + Notification). */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register(`${BASE_PATH}/sw.js`);
}

/** Returns true if this browser already has an active push subscription. */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/** Request permission, subscribe, and persist the subscription on the server. */
export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error("הדפדפן אינו תומך בהתראות");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("ההרשאה להתראות נדחתה");

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = sub.toJSON();
  const keys = json.keys ?? {};
  const supabase = createClient();
  const { error } = await supabase.rpc("push_subscribe", {
    p_endpoint: sub.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_ua: navigator.userAgent,
  });
  if (error) throw new Error(error.message);
}

/** Admin-only: send a test push to all admin devices (verified via JWT server-side). */
export async function sendTestPush(): Promise<{ sent: number }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("push-send", {
    body: { title: "התראת בדיקה ✓", body: "ההתראות פועלות כראוי", url: "/admin", target: "admins" },
  });
  if (error) throw new Error(error.message);
  return data as { sent: number };
}

/** Unsubscribe locally and remove the subscription from the server. */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const supabase = createClient();
  await supabase.rpc("push_unsubscribe", { p_endpoint: endpoint });
}
