import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getSessionContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null as Profile | null };

  const { data: profile } = await supabase
    .from("tiandy_il_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile: (profile as Profile) ?? null };
}

/** Prices are only meaningful to approved dealers (and admins). */
export function canSeePrices(profile: Profile | null) {
  return !!profile && (profile.status === "approved" || profile.role === "admin");
}
