"use client";

import * as React from "react";

/**
 * Mount-gated reduced-motion preference.
 *
 * Motion's own `useReducedMotion` reads the media query during the first client
 * render, which does not match the server render and breaks hydration for
 * visitors who prefer reduced motion. Reading it in an effect keeps the first
 * client render identical to the server's, then re-renders with the real value.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}
