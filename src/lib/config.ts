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
  "https://ptgjrtuhvefiuztolhea.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_7VsMNIZnR37FVGTbHtk44A_1ILMSXCS";

/** Sub-path the site is served from (e.g. "/Tiandy-store" on GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a local public asset (in /public) with the deployment base path. */
export function asset(path: string) {
  return `${BASE_PATH}${path}`;
}
