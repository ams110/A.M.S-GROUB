/**
 * Build a URL-safe slug. Keeps Latin letters/digits and Hebrew characters,
 * collapses everything else to single hyphens. Falls back to a random suffix
 * so a slug is never empty (e.g. a name written only in punctuation).
 */
export function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `item-${Math.random().toString(36).slice(2, 8)}`;
}
