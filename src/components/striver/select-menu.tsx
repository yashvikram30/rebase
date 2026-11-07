"use client";
import { usePathname } from "next/navigation";
import { usePopover } from "@/lib/use-popover";

export type SelectOption = { value: string; label: string; action?: boolean };

/** A themed replacement for a native <select> inside forms, using the same popover and list styles as the topic menu. */
export function SelectMenu({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const { open, setOpen, root } = usePopover(usePathname());
  const current = options.find((o) => o.value === value);

  return (
    <div className="st-menu st-field-menu" ref={root}>
      <button
        id={id}
        type="button"
        className="st-field-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current ? current.label : value}</span>
        <i className="striver-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul className="st-menu-pop" role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={o.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={
                  "st-menu-item" + (o.value === value ? " is-on" : "") + (o.action ? " is-action" : "")
                }
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
