import Link from "next/link";
import { AccountMenu } from "./account-menu";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";

/** The home page's top bar: where to go, and the account. The app itself navigates from its sidebar. */
export function SiteHeader() {
  return (
    <header className="site-top">
      <Brand href="/" />
      <nav aria-label="Main">
        <Link href="/plan">Course</Link>
        <Link href="/debug">Debug cases</Link>
        <Link href="/striver">Striver 180</Link>
      </nav>
      <span className="grow" />
      <ThemeToggle />
      <AccountMenu />
    </header>
  );
}
