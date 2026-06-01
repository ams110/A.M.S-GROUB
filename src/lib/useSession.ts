"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export type SessionState = {
  user: { id: string; email?: string } | null;
  profile: Profile | null;
  loading: boolean;
};

/** Client-side session + profile loader (replaces the old server helper). */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setState({ user: null, profile: null, loading: false });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (!active) return;
      setState({
        user: { id: user.id, email: user.email ?? undefined },
        profile: (profile as Profile) ?? null,
        loading: false,
      });
    };

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function canSeePrices(profile: Profile | null) {
  return !!profile && (profile.status === "approved" || profile.role === "admin");
}
