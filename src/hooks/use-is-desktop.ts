"use client";

import { useState, useEffect } from "react";

const DESKTOP_MIN_WIDTH = 768; // tailwind md breakpoint

/**
 * Returns true when the viewport is >= md breakpoint.
 * SSR-safe: returns false on the server / before mount, then snaps to the
 * actual value on the first client effect. Subscribes to changes.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}
