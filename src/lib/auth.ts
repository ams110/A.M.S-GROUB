"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

/** Returns true for any admin-level role. */
export function isAdminRole(role: Profile["role"] | undefined | null): boolean {
  return role === "admin" || role === "super_admin";
}

/** Prices are only meaningful to approved dealers and admins. */
export function canSeePrices(profile: Profile | null) {
  return !!profile && (profile.status === "approved" || isAdminRole(profile.role));
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
  isSuperAdmin: boolean;
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
    isSuperAdmin: false,
  });

  useEffect(() => {
    const supabase = createClient();

    const setReady = (partial: Omit<SessionState, "loading" | "ready">) =>
      setState({ loading: false, ready: true, ...partial });

    const noSession = () =>
      setReady({ userId: null, email: null, profile: null, showPrice: false, isSuperAdmin: false });

    // Fallback: if Supabase hangs (paused project, slow network), show the
    // login form after 5 s instead of staying dark forever.
    const fallback = setTimeout(noSession, 5000);

    const loadProfile = async (userId: string, email: string | undefined) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        clearTimeout(fallback);
        const profile = (data as Profile) ?? null;
        setReady({
          userId,
          email: email ?? null,
          profile,
          showPrice: canSeePrices(profile),
          isSuperAdmin: profile?.role === "super_admin",
        });
      } catch {
        clearTimeout(fallback);
        noSession();
      }
    };

    // onAuthStateChange fires INITIAL_SESSION immediately with the current
    // session (from cookies). Using it as the single source of truth avoids
    // a duplicate getSession() call and the race condition it caused.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        clearTimeout(fallback);
        noSession();
        return;
      }
      loadProfile(session.user.id, session.user.email);
    });

    return () => {
      clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
