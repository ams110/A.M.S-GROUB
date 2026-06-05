"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into <body> via a React portal.
 *
 * Modals/overlays use `position: fixed`, but a fixed element is positioned
 * relative to the nearest ancestor that establishes a containing block /
 * stacking context (e.g. an element with a running CSS animation like
 * `animate-fade-in`, which wraps every admin page). When that happens the
 * overlay gets trapped *inside* that context and the floating bottom nav /
 * header (z-40) paint on top of it — clipping the modal. Portaling to <body>
 * lifts the overlay to the root stacking context so its z-index wins.
 *
 * Mount-guarded so it never runs during static export / SSR (document only
 * exists in the browser).
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
