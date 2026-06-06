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

/**
 * VAPID public key for Web Push. Public by design (the matching private key lives
 * only server-side, in store.app_config, read by the push-send Edge Function).
 */
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
  "BA1zvmWPc124tSPR4J6fTMEH4LL7xC2ajSarB4DfBSTnvL4OuG3S2ZOYbiMBCsvVKVUq485ZV3Hdr0eWjMW5QYA";

/** Prefix a local public asset (in /public) with the deployment base path. */
export function asset(path: string) {
  return `${BASE_PATH}${path}`;
}

/**
 * Resolve a product image URL for display.
 *
 * Product photos come from Tiandy's CDN (bsg-i.nbxc.com), an Alibaba-Cloud host
 * that is slow or intermittently unreachable from some regions (e.g. Israel), so
 * direct hotlinks sometimes fail to load in the catalog. We route those through
 * images.weserv.nl — a free, Cloudflare-backed image proxy/CDN — which fetches
 * the source once and serves it from a globally reliable edge, also downscaling
 * the (often multi-megapixel) originals to trim bandwidth. Non-Tiandy URLs
 * (Supabase uploads, etc.) and a null url (→ placeholder) pass through unchanged.
 */
export function productImage(url: string | null | undefined) {
  if (!url) return asset("/placeholder.svg");
  if (url.includes("bsg-i.nbxc.com")) {
    const src = url.replace(/^https?:\/\//, "");
    return `https://images.weserv.nl/?url=ssl:${src}&w=1000&q=82`;
  }
  return url;
}
