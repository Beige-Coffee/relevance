"use client";

import { useEffect, useState } from "react";

// Single source of truth for "mobile-ish viewport." Used to swap the home
// page from a side-by-side graph+chat layout to a stacked one, and to
// disable the chat panel's drag-resize on touch screens.
//
// Breakpoint matches Tailwind's `md` so component-level Tailwind classes
// and this hook stay in sync.
export function useIsMobile(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpointPx]);
  return isMobile;
}
