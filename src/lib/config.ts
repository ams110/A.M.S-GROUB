/**
 * Supabase connection settings.
 *
 * These are committed on purpose so the app can be built and deployed to a
 * static host (e.g. GitHub Pages) without configuring any server-side secrets.
 *
 * This is safe: the URL and the *publishable / anon* key are designed to be
 * shipped in the browser. All real access control is enforced by Postgres
 * Row Level Security (RLS) on the Supabase project — the key only grants what
 * RLS allows. Never put the `service_role` key here.
 *
 * Environment variables, when present, take precedence so local development or
 * a different project can override these values without editing the file.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rvhjrzbhugvytvktdhor.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2aGpyemJodWd2eXR2a3RkaG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjU1OTMsImV4cCI6MjA5MTg0MTU5M30.LxAACOi1papCp197qsQIdWkm9hIJNY0o-Hc9YiMHPWE";

/** Sub-path the site is served from (e.g. "/Tiandy-store" on GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a local public asset (in /public) with the deployment base path. */
export function asset(path: string) {
  return `${BASE_PATH}${path}`;
}
