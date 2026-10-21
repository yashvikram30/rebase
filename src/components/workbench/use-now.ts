"use client";
import { useCallback, useRef, useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};

/** The current time in whole seconds, ticking once a second. Reads 0 on the server so hydration matches. */
export const useNowSeconds = () =>
  useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000),
    () => 0,
  );

const never = () => () => {};

/**
 * The time this component first rendered in the browser, fixed for its lifetime. Reads 0 on the server so
 * prerendering never touches the clock and hydration matches.
 */
export function useOpenedAt() {
  const opened = useRef(0);
  const read = useCallback(() => (opened.current ||= Date.now()), []);
  return useSyncExternalStore(never, read, () => 0);
}
