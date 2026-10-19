"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { MobileBar } from "./mobile-bar";
import type { ProductId } from "@/lib/products";

/**
 * The page frame for everything outside the course: Debug and the account pages. The same sidebar as
 * Learn, but no course outline, search or "on this page" column, and none of the course's data.
 */
export function BareShell({
  product,
  wide = false,
  className,
  children,
}: {
  product?: ProductId;
  wide?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  // A link in the sidebar closes it on phones; so does changing page any other way.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setNavOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className={className ? `shell ${className}` : "shell"}
      data-bare={wide ? "wide" : "true"}
      data-product={product}
    >
      <a className="skip" href="#main">
        Skip to content
      </a>
      <MobileBar navOpen={navOpen} onMenu={() => setNavOpen((v) => !v)} />
      <div className="layout">
        <AppSidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <div className={"scrim" + (navOpen ? " open" : "")} onClick={() => setNavOpen(false)} />
    </div>
  );
}
