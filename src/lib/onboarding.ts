/**
 * Helpers for onboarding a new customer (dealer/contractor) in one flow:
 * generating credentials and sending them over WhatsApp.
 *
 * All client-side — works on the static export (no server needed). WhatsApp
 * delivery uses the public `wa.me` deep link, which opens the chat with the
 * customer and a pre-filled message the admin just taps "send" on.
 */

/** Normalize an Israeli phone number to the international form wa.me expects. */
export function waPhone(raw: string): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "972" + d.slice(1);
  else if (!d.startsWith("972")) d = "972" + d;
  return d;
}

/** Generate a readable password (no ambiguous chars like 0/O, 1/l/I). */
export function genPassword(len = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const arr = new Uint32Array(len);
  (globalThis.crypto ?? ({} as Crypto)).getRandomValues?.(arr);
  for (let i = 0; i < len; i++) {
    const n = arr[i] ?? Math.floor(Math.random() * 0xffffffff);
    s += chars[n % chars.length];
  }
  return s;
}

/** The login credentials message we send the new customer over WhatsApp. */
export function welcomeMessage(opts: {
  name?: string;
  loginUrl: string;
  login: string;
  password: string;
}): string {
  const hi = opts.name ? `שלום ${opts.name} 👋` : "שלום 👋";
  return [
    hi,
    "נפתח עבורך חשבון ב-Â.M.Ŝ GROUP — פורטל ההזמנות הרשמי.",
    "",
    `🔗 כניסה: ${opts.loginUrl}`,
    `👤 שם משתמש: ${opts.login}`,
    `🔑 סיסמה: ${opts.password}`,
    "",
    "מומלץ להחליף את הסיסמה לאחר הכניסה הראשונה.",
    "נשמח לראותך! 🤝",
  ].join("\n");
}

/** Message sent when an admin resets a customer's password. */
export function passwordResetMessage(opts: {
  name?: string;
  loginUrl: string;
  login: string;
  password: string;
}): string {
  const hi = opts.name ? `שלום ${opts.name} 👋` : "שלום 👋";
  return [
    hi,
    "סיסמת הכניסה שלך ל-Â.M.Ŝ GROUP אופסה.",
    "",
    `🔗 כניסה: ${opts.loginUrl}`,
    `👤 שם משתמש: ${opts.login}`,
    `🔑 סיסמה חדשה: ${opts.password}`,
    "",
    "מומלץ להחליף את הסיסמה לאחר הכניסה.",
  ].join("\n");
}

/** Build a ready-to-open wa.me link with the welcome message pre-filled. */
export function waLink(phone: string, message: string): string {
  return `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(message)}`;
}
