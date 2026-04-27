"use client";

import { useSyncExternalStore } from "react";

function subscribe(query: string, callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const mq = window.matchMedia(query);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => subscribe(query, callback),
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)");
}

export function useIsTablet() {
  return useMediaQuery("(max-width: 1023px)");
}
