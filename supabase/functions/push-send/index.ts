import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Payload = {
  secret?: string;
  title?: string;
  body?: string;
  url?: string;
  target?: "admins" | string; // 'admins' or a specific profile_id
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const store = db.schema("store");

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  // ── Load server config (VAPID + hook secret) ──────────────────────────────
  const { data: cfgRows, error: cfgErr } = await store.from("app_config").select("key, value");
  if (cfgErr) return json({ error: "config_unavailable" }, 500);
  const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));

  // ── Authorize: hook secret (DB trigger) OR admin JWT (manual/test) ────────
  let authorized = false;
  if (payload.secret && cfg.push_hook_secret && payload.secret === cfg.push_hook_secret) {
    authorized = true;
  } else {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token) {
      const { data: u } = await db.auth.getUser(token);
      if (u?.user) {
        const { data: prof } = await store.from("profiles").select("role").eq("id", u.user.id).single();
        if (prof && (prof.role === "admin" || prof.role === "super_admin")) authorized = true;
      }
    }
  }
  if (!authorized) return json({ error: "unauthorized" }, 401);

  if (!cfg.vapid_public_key || !cfg.vapid_private_key) return json({ error: "vapid_missing" }, 500);
  webpush.setVapidDetails(cfg.vapid_subject ?? "mailto:admin@ams-groub.linko.services", cfg.vapid_public_key, cfg.vapid_private_key);

  // ── Resolve target subscriptions ──────────────────────────────────────────
  let targetIds: string[] | null = null;
  if (!payload.target || payload.target === "admins") {
    const { data: admins } = await store.from("profiles").select("id").in("role", ["admin", "super_admin"]);
    targetIds = (admins ?? []).map((a) => a.id);
    if (targetIds.length === 0) return json({ sent: 0, note: "no_admins" });
  } else {
    targetIds = [payload.target];
  }

  const { data: subs, error: subErr } = await store
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("profile_id", targetIds);
  if (subErr) return json({ error: "subs_unavailable" }, 500);

  const notification = JSON.stringify({
    title: payload.title ?? "Â.M.Ŝ GROUP",
    body: payload.body ?? "",
    url: payload.url ?? "/",
  });

  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, notification);
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) stale.push(s.id); // gone — clean up
      }
    })
  );

  if (stale.length) await store.from("push_subscriptions").delete().in("id", stale);

  return json({ sent, stale: stale.length, total: subs?.length ?? 0 });
});
