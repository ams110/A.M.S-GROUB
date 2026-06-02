"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

/** Prices are only meaningful to approved dealers (and admins). */
export function canSeePrices(profile: Profile | null) {
  return !!profile && (profile.status === "approved" || profile.role === "admin");
}

export type SessionState = {
  /** Still loading the session/profile on first paint. */
  loading: boolean;
  /** True once the auth check has finished (signed in or not). */
  ready: boolean;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  showPrice: boolean;
};

/**
 * Client-side session + dealer profile.
 *
 * Replaces the old server-side `getSessionContext`. Since the app is a static
 * (client-rendered) site, the Supabase session lives in the browser and all
 * access is enforced by RLS — this hook is only for showing the right UI.
 */
export function useProfile(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: true,
    ready: false,
    userId: null,
    email: null,
    profile: null,
    showPrice: false,
  });

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      // getSession() reads the cached session locally (instant) instead of a
      // round-trip to the auth server on every page. This is UI-only; data
      // access is still enforced server-side by RLS.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      if (!user) {
        setState({
          loading: false,
          ready: true,
          userId: null,
          email: null,
          profile: null,
          showPrice: false,
        });
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const profile = (data as Profile) ?? null;
      setState({
        loading: false,
        ready: true,
        userId: user.id,
        email: user.email ?? null,
        profile,
        showPrice: canSeePrices(profile),
      });
    };

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}
