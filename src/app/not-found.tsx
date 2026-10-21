import type { Metadata } from "next";
import Link from "next/link";
import "./not-found.css";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Shown for unknown URLs and for notFound() anywhere in the app. It stands alone: the app shell's
 * sidebar and header are hidden while it is on screen (see the `:has(.nf)` rules in focus.css).
 */
export default function NotFound() {
  return (
    <section className="nf">
      <article>
        <p className="nf-eyebrow">404</p>
        <h1>That page does not exist</h1>
        <p className="lead">The link may be old or mistyped.</p>
        <p className="nf-actions">
          <Link className="btn primary" href="/learn">
            Go to Today
          </Link>
          <Link className="btn" href="/plan">
            Browse the plan
          </Link>
        </p>
      </article>
    </section>
  );
}
