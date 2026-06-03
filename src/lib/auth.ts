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

    const loadProfile = async (userId: string, email: string | undefined) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      const profile = (data as Profile) ?? null;
      setState({
        loading: false,
        ready: true,
        userId,
        email: email ?? null,
        profile,
        showPrice: canSeePrices(profile),
        isSuperAdmin: profile?.role === "super_admin",
      });
    };

    // onAuthStateChange fires INITIAL_SESSION immediately with the current
    // session (from cookies). Using it as the single source of truth avoids
    // a duplicate getSession() call and the race condition it caused.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setState({
          loading: false,
          ready: true,
          userId: null,
          email: null,
          profile: null,
          showPrice: false,
          isSuperAdmin: false,
        });
        return;
      }
      loadProfile(session.user.id, session.user.email);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}
