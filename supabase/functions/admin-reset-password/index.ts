import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Admin-only endpoint: resets the password of an existing customer (dealer)
// login. Requires the service role, so it must run server-side.
//
// Deployed to the Supabase project (function name: admin-reset-password).
// This copy is kept in the repo for version control / review.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1) Identify the caller from their JWT and confirm they are a store admin.
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) return json({ error: "unauthorized" }, 401);

  const { data: callerProfile } = await admin
    .schema("store")
    .from("profiles")
    .select("role")
    .eq("id", caller.user.id)
    .single();
  if (!["admin", "super_admin"].includes(callerProfile?.role ?? "")) {
    return json({ error: "forbidden" }, 403);
  }

  // 2) Validate input.
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const user_id = (body.user_id ?? "").trim();
  const password = body.password ?? "";
  if (!user_id || password.length < 6) return json({ error: "invalid_input" }, 400);

  // 3) Only dealers may be reset here — never another admin / super_admin
  //    (prevents privilege escalation by hijacking a staff account).
  const { data: target } = await admin
    .schema("store")
    .from("profiles")
    .select("role")
    .eq("id", user_id)
    .single();
  if (!target) return json({ error: "not_found" }, 404);
  if (target.role !== "dealer") return json({ error: "forbidden_target" }, 403);

  // 4) Reset the password.
  const { error: updErr } = await admin.auth.admin.updateUserById(user_id, { password });
  if (updErr) return json({ error: "reset_failed", message: updErr.message }, 400);

  return json({ ok: true });
});
