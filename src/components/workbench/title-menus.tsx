"use client";
import { useEffect, useRef, useState } from "react";

/** Closes a popover on an outside click or Esc. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return { open, setOpen, root };
}

/** Run, with the other way to run tests tucked behind the arrow. */
export function RunSplit({
  disabled,
  onRun,
  onRunAll,
}: {
  disabled: boolean;
  onRun: () => void;
  onRunAll: () => void;
}) {
  const { open, setOpen, root } = usePopover();
  return (
    <div className="wb-split-btn" ref={root}>
      <button
        type="button"
        className="wb-btn is-run"
        onClick={onRun}
        disabled={disabled}
        title="Run the failing test (Ctrl+Enter)"
      >
        Run
      </button>
      <button
        type="button"
        className="wb-btn is-run is-caret"
        aria-label="More ways to run"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="wb-pop" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRun();
            }}
          >
            Run failing test <kbd>Ctrl ↵</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRunAll();
            }}
          >
            Run all tests <kbd>Ctrl ⇧ ↵</kbd>
          </button>
        </div>
      )}
    </div>
  );
}

export type MenuItem = { label: string; onSelect: () => void; keepOpen?: boolean; href?: string };

/** The rarely used actions, out of the way. */
export function MoreMenu({ items }: { items: MenuItem[] }) {
  const { open, setOpen, root } = usePopover();
  return (
    <div className="wb-more" ref={root}>
      <button
        type="button"
        className="wb-tool is-icon"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="wb-pop is-right" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                it.onSelect();
                if (!it.keepOpen) setOpen(false);
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
