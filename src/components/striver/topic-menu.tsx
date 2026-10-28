"use client";
import { usePathname } from "next/navigation";
import { usePopover } from "@/lib/use-popover";

type Option = { value: string; label: string; count: number };

/** A themed replacement for the native topic <select>, built on the same popover behaviour as the header menus. */
export function TopicMenu({
  value,
  options,
  total,
  onChange,
}: {
  value: string;
  options: Option[];
  total: number;
  onChange: (value: string) => void;
}) {
  const { open, setOpen, root } = usePopover(usePathname());
  const current = options.find((o) => o.value === value);
  const all: Option = { value: "all", label: "All topics", count: total };

  return (
    <div className="st-menu" ref={root}>
      <button
        type="button"
        className={"striver-btn st-menu-btn" + (current ? " is-set" : "")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current ? current.label : "All topics"}</span>
        <i className="striver-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul className="st-menu-pop" role="listbox" aria-label="Topic">
          {[all, ...options].map((o) => (
            <li key={o.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={"st-menu-item" + (o.value === value ? " is-on" : "")}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                <small>{o.count}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
