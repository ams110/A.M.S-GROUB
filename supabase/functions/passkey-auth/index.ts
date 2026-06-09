import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "npm:@simplewebauthn/server@13";
import type { AuthenticationResponseJSON } from "npm:@simplewebauthn/types@10";

const RP_ID  = Deno.env.get("WEBAUTHN_RP_ID")  ?? "ams-groub.linko.services";
const ORIGIN = Deno.env.get("WEBAUTHN_ORIGIN") ?? "https://ams-groub.linko.services";

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

function fromBase64URL(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Extract the challenge the authenticator actually signed, from clientDataJSON,
// so we match the exact challenge row instead of "the latest anon one" (which is
// racy when several sign-in attempts overlap).
function challengeFromClientData(clientDataJSON: string): string | null {
  try {
    const base64 = clientDataJSON.replace(/-/g, "+").replace(/_/g, "/");
    const data = JSON.parse(atob(base64));
    return typeof data.challenge === "string" ? data.challenge : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")    return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

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

    // Discoverable-credential flow: no allowCredentials — the browser presents
    // all registered passkeys for this RP and the user picks one.
    const options = await generateAuthenticationOptions({
      rpID:             RP_ID,
      userVerification: "required",
      allowCredentials: [],
    });

    const { error: insertErr } = await admin
      .schema("store")
      .from("passkey_challenges")
      .insert({ challenge: options.challenge, user_id: null });

    if (insertErr) return json({ error: "db_error", message: insertErr.message }, 500);
    return json({ options });
  }

  // ── FINISH ──────────────────────────────────────────────────────────────────
  if (body.action === "finish") {
    try {
      const credential = body.credential as AuthenticationResponseJSON;
      if (!credential) return json({ error: "missing_credential" }, 400);

      // Match the exact challenge the authenticator signed; fall back to the
      // most recent anonymous challenge if it can't be parsed.
      const signed = challengeFromClientData(
        (credential.response as { clientDataJSON: string }).clientDataJSON,
      );
      let row: { id: string; challenge: string; created_at: string } | null = null;
      if (signed) {
        const { data } = await admin.schema("store").from("passkey_challenges")
          .select("id, challenge, created_at").eq("challenge", signed).limit(1).maybeSingle();
        row = data as typeof row;
      }
      if (!row) {
        const { data } = await admin.schema("store").from("passkey_challenges")
          .select("id, challenge, created_at").is("user_id", null)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        row = data as typeof row;
      }

      if (!row) return json({ error: "challenge_not_found" }, 400);
      if (Date.now() - new Date(row.created_at).getTime() > 5 * 60_000)
        return json({ error: "challenge_expired" }, 400);

      await admin.schema("store").from("passkey_challenges").delete().eq("id", row.id);

      // Look up the credential across all of the user's registered devices.
      const { data: cred, error: credErr } = await admin
        .schema("store").from("passkey_credentials")
        .select("id, user_id, credential_id, public_key, counter")
        .eq("credential_id", credential.id).maybeSingle();

      if (credErr || !cred) return json({ error: "credential_not_found" }, 401);

      // Verify the assertion. @simplewebauthn/server v10+ takes `credential`
      // ({ id, publicKey, counter }); v13 is pinned so the param shape matches.
      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response:          credential,
          expectedChallenge: row.challenge,
          expectedOrigin:    ORIGIN,
          expectedRPID:      RP_ID,
          credential: {
            id:        cred.credential_id as string,
            publicKey: fromBase64URL(cred.public_key as string),
            counter:   cred.counter as number,
          },
          requireUserVerification: true,
        });
      } catch (e) {
        return json({ error: "verification_error", message: String(e) }, 400);
      }

      if (!verification.verified) return json({ error: "verification_failed" }, 401);

      // Update counter (replay-attack prevention) + last-used timestamp
      await admin
        .schema("store").from("passkey_credentials")
        .update({
          counter: verification.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", cred.id as string);

      // Generate a one-time email OTP for the client to complete the login.
      const { data: authUser } = await admin.auth.admin.getUserById(cred.user_id as string);
      if (!authUser?.user?.email) return json({ error: "user_not_found" }, 500);

      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink", email: authUser.user.email, options: { shouldCreateUser: false },
      });
      if (linkErr || !linkData?.properties?.email_otp)
        return json({ error: "session_error", message: linkErr?.message }, 500);

      // The client completes login with verifyOtp({ email, token, type: "email" }).
      return json({ ok: true, email: authUser.user.email, token: linkData.properties.email_otp });
    } catch (e) {
      return json({ error: "finish_exception", message: String(e) }, 500);
    }
  }

  return json({ error: "unknown_action" }, 400);
});
