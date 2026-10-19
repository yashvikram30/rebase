"use client";
import { AccountMenu } from "./account-menu";
import { Brand } from "./brand";
import { Icon } from "./icons";

/** The slim top bar shown only on narrow screens, where the sidebar hides behind the menu button. */
export function MobileBar({ navOpen, onMenu }: { navOpen: boolean; onMenu: () => void }) {
  return (
    <header className="top">
      <button
        className="icon-btn menu-btn"
        type="button"
        aria-label={navOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={navOpen}
        aria-controls="nav"
        onClick={onMenu}
      >
        {Icon.menu}
      </button>
      <Brand href="/" />
      <span className="grow" />
      <AccountMenu />
    </header>
  );
}
