"use client";

import { useSyncExternalStore } from "react";
import type { StriverProblem } from "./striver-types";

const KEY = "csplan.striver.user_problems.v1";

let snapshot: StriverProblem[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    snapshot = raw ? JSON.parse(raw) : [];
  } catch {
    snapshot = [];
  }
}

function commit(next: StriverProblem[]) {
  snapshot = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable or full
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      loaded = false;
      load();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useUserProblems(): {
  userProblems: StriverProblem[];
  addUserProblem: (p: Omit<StriverProblem, "id" | "isCustom" | "slug">) => void;
  deleteUserProblem: (id: number) => void;
} {
  const userProblems = useSyncExternalStore(
    subscribe,
    () => {
      load();
      return snapshot;
    },
    () => [],
  );

  const addUserProblem = (p: Omit<StriverProblem, "id" | "isCustom" | "slug">) => {
    load();
    const id = Date.now() % 1000000 + 50000;
    const slug = p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const newProblem: StriverProblem = {
      ...p,
      id,
      slug,
      isCustom: true,
    };
    commit([...snapshot, newProblem]);
  };

  const deleteUserProblem = (id: number) => {
    load();
    commit(snapshot.filter((p) => p.id !== id));
  };

  return { userProblems, addUserProblem, deleteUserProblem };
}
