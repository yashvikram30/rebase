"use client";
import { Icon } from "./icons";

export function toggleTheme() {
  const root = document.documentElement;
  const current =
    root.getAttribute("data-theme") ??
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  const apply = () => {
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("csplan.theme", next);
    } catch {}
  };
  // Crossfade the whole page when the browser can, instead of snapping.
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches)
    document.startViewTransition(apply);
  else apply();
}

export function ThemeToggle() {
  return (
    <button className="icon-btn" type="button" aria-label="Toggle dark mode" onClick={toggleTheme}>
      {Icon.moon}
    </button>
  );
}
