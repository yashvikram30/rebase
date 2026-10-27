"use client";
import { AccountMenu } from "./account-menu";
import { Brand } from "./brand";
import { Icon } from "./icons";

/** The slim top bar: the sidebar lives in a drawer that opens from the menu button on the right. */
export function MobileBar({
  navOpen,
  onMenu,
  actions,
}: {
  navOpen: boolean;
  onMenu: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <header className="top">
      <Brand href="/" />
      <span className="grow" />
      {actions}
      <AccountMenu />
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
    </header>
  );
}
