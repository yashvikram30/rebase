"use client";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const details = [error.digest && `ref ${error.digest}`, error.message].filter(Boolean).join(" | ");
  return (
    <article>
      <h1>Something went wrong</h1>
      <p className="lead">The page failed to load. Your progress is safe in this browser. Try again.</p>
      <p>
        <button className="btn primary" type="button" onClick={reset}>
          Try again
        </button>{" "}
        <Link className="btn" href="/">
          Go home
        </Link>{" "}
        <button
          className="btn"
          type="button"
          onClick={() => void navigator.clipboard?.writeText(details || "unknown error")}
        >
          Copy details
        </button>
      </p>
    </article>
  );
}
