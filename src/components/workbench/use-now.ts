"use client";
import { useSyncExternalStore } from "react";

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
