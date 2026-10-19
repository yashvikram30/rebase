import Link from "next/link";
import { PLATFORM } from "@/lib/products";

/** The platform mark and name. `href` is the home of whichever product the header belongs to. */
export function Brand({ href }: { href: string }) {
  return (
    <Link className="brand" href={href}>
      <span className="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
          <path d="M6 4.5h10.5a1.5 1.5 0 0 1 1.5 1.5v13H7.5A1.5 1.5 0 0 1 6 17.5v-13Z" fill="#ffffff" />
          <path d="M13 4.5v7l2-1.4 2 1.4v-7h-4Z" fill="#2b4ddb" />
        </svg>
      </span>
      {PLATFORM}
    </Link>
  );
}
