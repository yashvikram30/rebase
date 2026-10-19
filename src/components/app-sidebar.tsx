"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./account-menu";
import { Brand } from "./brand";
import { Icon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

type SideLink = { href: string; label: string; also?: string[] };

// Paths that belong to Course: the syllabus and everything inside it.
const COURSE_PATHS = ["/week", "/day", "/month", "/foundations", "/python"];

const SECTIONS: { name: string; links: SideLink[] }[] = [
  {
    name: "Learn",
    links: [
      { href: "/learn", label: "Today" },
      { href: "/plan", label: "Course", also: COURSE_PATHS },
      { href: "/revise", label: "Revise" },
      { href: "/notes", label: "Notes" },
      { href: "/schedule", label: "Schedule", also: ["/start"] },
    ],
  },
  {
    name: "Debug",
    links: [
      { href: "/debug", label: "Cases", also: ["/debug/"] },
      { href: "/debug/random", label: "Random round" },
    ],
  },
];

const under = (pathname: string, p: string) =>
  pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/");

/** True on the syllabus and the pages inside it, where the sidebar shows the course outline. */
export const isCoursePath = (pathname: string) =>
  pathname === "/plan" || COURSE_PATHS.some((p) => under(pathname, p));

/**
 * The app's one navigation surface: both products and their pages, the course outline when you are in the
 * course, and search, theme and account at the bottom. On phones it slides in from the menu button.
 */
export function AppSidebar({
  open,
  onNavigate,
  onSearch,
  onFocus,
  outline,
}: {
  open: boolean;
  onNavigate: () => void;
  onSearch?: () => void;
  onFocus?: () => void;
  outline?: React.ReactNode;
}) {
  const pathname = usePathname();
  // The most specific match wins, so /debug/random marks Random round and not Cases.
  const all = SECTIONS.flatMap((s) => s.links);
  const score = (l: SideLink) =>
    pathname === l.href
      ? 1000
      : Math.max(-1, ...(l.also ?? []).filter((p) => under(pathname, p)).map((p) => p.length));
  const best = all.reduce<SideLink | null>(
    (b, l) => (score(l) >= 0 && (!b || score(l) > score(b)) ? l : b),
    null,
  );

  return (
    <nav className={"nav sb" + (open ? " open" : "")} id="nav" aria-label="Rebase">
      <div className="sb-brand">
        <Brand href="/" />
      </div>
      {onSearch && (
        <button className="sb-search" type="button" onClick={onSearch}>
          {Icon.search}
          <span>Search the course</span>
          <kbd>/</kbd>
        </button>
      )}
      {SECTIONS.map((s) => (
        <div key={s.name} className="sb-group">
          <h2>{s.name}</h2>
          {s.links.map((l) => (
            <div key={l.href}>
              <Link
                href={l.href}
                className={"sb-link" + (best === l ? " on" : "")}
                aria-current={best === l ? "page" : undefined}
                onClick={onNavigate}
              >
                {l.label}
              </Link>
              {l.href === "/plan" && outline && <div className="sb-outline">{outline}</div>}
            </div>
          ))}
        </div>
      ))}
      <div className="sb-foot">
        <AccountMenu />
        <span className="grow" />
        {onFocus && (
          <button
            className="icon-btn"
            type="button"
            aria-label="Focus mode"
            title="Focus mode (F)"
            onClick={onFocus}
          >
            {Icon.expand}
          </button>
        )}
        <ThemeToggle />
      </div>
    </nav>
  );
}
