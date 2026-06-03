import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@9";
import type { RegistrationResponseJSON } from "npm:@simplewebauthn/types@9";

const RP_ID   = Deno.env.get("WEBAUTHN_RP_ID")   ?? "ams110.github.io";
const ORIGIN  = Deno.env.get("WEBAUTHN_ORIGIN")  ?? "https://ams110.github.io";
const RP_NAME = "Â.M.Ŝ GROUP";

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

// base64url helpers (Web APIs — no Node.js/Buffer needed)
function toBase64URL(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")    return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Require a valid user JWT for both actions
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  // ── START ─────────────────────────────────────────────────────────────────
  if (body.action === "start") {
    // Garbage-collect stale challenges (> 5 min old)
    await admin
      .schema("store")
      .from("passkey_challenges")
      .delete()
      .lt("created_at", new Date(Date.now() - 5 * 60_000).toISOString());

    const { data: profile } = await admin
      .schema("store")
      .from("profiles")
      .select("full_name, company")
      .eq("id", user.id)
      .single();

    const options = await generateRegistrationOptions({
      rpID:            RP_ID,
      rpName:          RP_NAME,
      userName:        user.email!,
      userDisplayName: profile?.company || profile?.full_name || user.email!,
      userID:          new TextEncoder().encode(user.id),
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification:        "required",
        residentKey:             "required",
      },
    });

    const { error: insertErr } = await admin
      .schema("store")
      .from("passkey_challenges")
      .insert({ challenge: options.challenge, user_id: user.id });

    if (insertErr) return json({ error: "db_error", message: insertErr.message }, 500);

    return json({ options });
  }

  // ── FINISH ────────────────────────────────────────────────────────────────
  if (body.action === "finish") {
    const credential = body.credential as RegistrationResponseJSON;
    if (!credential) return json({ error: "missing_credential" }, 400);

    // Retrieve & delete challenge (one-time use)
    const { data: row, error: rowErr } = await admin
      .schema("store")
      .from("passkey_challenges")
      .select("id, challenge, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (rowErr || !row) return json({ error: "challenge_not_found" }, 400);

    // Reject challenges older than 5 minutes
    if (Date.now() - new Date(row.created_at as string).getTime() > 5 * 60_000) {
      return json({ error: "challenge_expired" }, 400);
    }

    await admin.schema("store").from("passkey_challenges").delete().eq("id", row.id);

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response:           credential,
        expectedChallenge:  row.challenge as string,
        expectedOrigin:     ORIGIN,
        expectedRPID:       RP_ID,
        requireUserVerification: true,
      });
    } catch (e) {
      return json({ error: "verification_error", message: String(e) }, 400);
    }

    if (!verification.verified || !verification.registrationInfo) {
      return json({ error: "verification_failed" }, 400);
    }

    const { credential: cred } = verification.registrationInfo;

    const { error: updateErr } = await admin
      .schema("store")
      .from("profiles")
      .update({
        passkey_credential_id: cred.id,
        passkey_public_key:    toBase64URL(cred.publicKey),
        passkey_counter:       cred.counter,
      })
      .eq("id", user.id);

    if (updateErr) return json({ error: "save_failed", message: updateErr.message }, 500);

    return json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});
