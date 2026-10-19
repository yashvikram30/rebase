"use client";
import { usePathname } from "next/navigation";
import { ViewTransition, useCallback, useEffect, useState } from "react";
import { AppSidebar, isCoursePath } from "./app-sidebar";
import { Icon } from "./icons";
import { MobileBar } from "./mobile-bar";
import { NavTree, type NavPhase } from "./nav-tree";
import { QuickCapture } from "./quick-capture";
import { SearchDialog, type SearchEntry } from "./search-dialog";
import { Toc } from "./toc";

export function AppShell({
  phases,
  search,
  children,
}: {
  phases: NavPhase[];
  search: SearchEntry[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  // Focus mode hides everything but the page; where the browser allows it, it also goes full screen.
  const toggleFocus = useCallback(() => {
    setFocus((on) => {
      const next = !on;
      try {
        if (next) void document.documentElement.requestFullscreen?.()?.catch(() => {});
        else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      } catch {
        // No Fullscreen API (some phones): the focused layout still works.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "f" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        toggleFocus();
      } else if (e.key === "Escape") {
        setNavOpen(false);
      }
    }
    // Leaving browser full screen with Esc leaves focus mode too.
    function onFullscreen() {
      if (!document.fullscreenElement) setFocus(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [toggleFocus]);

  return (
    <div className="shell" data-focus={focus ? "on" : undefined}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <MobileBar navOpen={navOpen} onMenu={() => setNavOpen((v) => !v)} />
      {focus && (
        <button
          className="focus-exit"
          type="button"
          aria-label="Exit focus mode"
          title="Exit focus mode (F)"
          onClick={toggleFocus}
        >
          {Icon.collapse}
          <span>Exit focus</span>
        </button>
      )}
      <div className="layout">
        <AppSidebar
          open={navOpen}
          onNavigate={closeNav}
          onSearch={() => setSearchOpen(true)}
          onFocus={toggleFocus}
          outline={isCoursePath(pathname) ? <NavTree phases={phases} onNavigate={closeNav} /> : undefined}
        />
        <main id="main" tabIndex={-1}>
          <ViewTransition default="page">{children}</ViewTransition>
        </main>
        <aside className="toc" aria-label="On this page">
          <Toc />
        </aside>
      </div>
      <div className={"scrim" + (navOpen ? " open" : "")} onClick={closeNav} />
      <QuickCapture />
      <SearchDialog entries={search} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
