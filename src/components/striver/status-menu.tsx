"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePopover } from "@/lib/use-popover";
import { RED_INTERVALS_DAYS, YELLOW_INTERVALS_DAYS, type ProblemStatus } from "@/lib/striver-types";

const days = (list: readonly number[]) => list.join(", ");

const OPTIONS: { value: ProblemStatus; label: string; hint: string }[] = [
  { value: "green", label: "Green", hint: "Solved on your own" },
  { value: "yellow", label: "Yellow", hint: `Needed a hint · reviews at ${days(YELLOW_INTERVALS_DAYS)} days` },
  { value: "red", label: "Red", hint: `Couldn't solve it · reviews at ${days(RED_INTERVALS_DAYS)} days` },
  { value: "unattempted", label: "Not attempted", hint: "Clears its reviews" },
];

const POP_HEIGHT = 230;

/** The "How it went" dropdown: the topic menu's look, with a fixed popup so the scrolling table never clips it. */
export function StatusMenu({
  value,
  label,
  onChange,
}: {
  value: ProblemStatus;
  label: string;
  onChange: (value: ProblemStatus) => void;
}) {
  const { open, setOpen, root } = usePopover(usePathname());
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[3];

  // The popup is fixed, so it would drift from its button while the page scrolls: close it instead.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, setOpen]);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    if (!open) {
      const r = e.currentTarget.getBoundingClientRect();
      const flip = r.bottom + POP_HEIGHT > window.innerHeight && r.top > POP_HEIGHT;
      setPos({ top: flip ? r.top - POP_HEIGHT - 6 : r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 288)) });
    }
    setOpen((v) => !v);
  }

  return (
    <div className="st-menu st-status" ref={root}>
      <button
        type="button"
        className={"striver-btn st-menu-btn st-status-btn" + (value !== "unattempted" ? " is-" + value : "")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Status of ${label}: ${current.label}`}
        onClick={toggle}
      >
        <span className={"st-dot is-" + value} aria-hidden="true" />
        <span>{current.label}</span>
        <i className="striver-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul className="st-menu-pop st-status-pop" role="listbox" aria-label="How it went" style={pos}>
          {OPTIONS.map((o) => (
            <li key={o.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={"st-menu-item st-status-item" + (o.value === value ? " is-on" : "")}
                onClick={() => {
                  setOpen(false);
                  onChange(o.value);
                }}
              >
                <span className={"st-dot is-" + o.value} aria-hidden="true" />
                <span className="st-status-text">
                  <strong>{o.label}</strong>
                  <small>{o.hint}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
