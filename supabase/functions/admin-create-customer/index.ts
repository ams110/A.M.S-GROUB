import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Admin-only endpoint: creates a customer (dealer/contractor) login with an
// email + password. Requires the service role, so it must run server-side.
//
// Deployed to the Supabase project (function name: admin-create-customer).
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
  if (!["admin", "super_admin"].includes(callerProfile?.role ?? "")) return json({ error: "forbidden" }, 403);

  // 2) Validate input.
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const customer_type = body.customer_type === "contractor" ? "contractor" : "dealer";
  if (!email || password.length < 6) return json({ error: "invalid_input" }, 400);

  // 3) Create the auth user (email pre-confirmed so they can sign in at once).
  const meta = {
    full_name: body.full_name ?? "",
    phone: body.phone ?? "",
    company: body.company ?? "",
    customer_type,
  };
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (createErr || !created?.user) {
    return json({ error: "create_failed", message: createErr?.message }, 400);
  }

  // 4) Ensure the profile is approved with the right type/details. (The signup
  //    trigger creates it as pending; admin-created accounts are approved.)
  await admin
    .schema("store")
    .from("profiles")
    .upsert(
      {
        id: created.user.id,
        status: "approved",
        customer_type,
        full_name: meta.full_name || null,
        phone: meta.phone || null,
        company: meta.company || null,
      },
      { onConflict: "id" },
    );

  return json({ ok: true, id: created.user.id });
});
