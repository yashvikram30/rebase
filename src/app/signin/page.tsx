import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthGate, AuthSkeleton } from "@/components/auth-gate";
import { SignInButtons } from "@/components/signin-buttons";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <AuthGate>
        <main className="auth">
          <aside className="auth-aside">
            <Link className="auth-brand" href="/">
              <span className="logo" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                  <path
                    d="M6 4.5h10.5a1.5 1.5 0 0 1 1.5 1.5v13H7.5A1.5 1.5 0 0 1 6 17.5v-13Z"
                    fill="#ffffff"
                  />
                  <path d="M13 4.5v7l2-1.4 2 1.4v-7h-4Z" fill="#2b4ddb" />
                </svg>
              </span>
              Rebase
            </Link>
            <div className="auth-pitch">
              <h2>Keep your progress in Learn and Debug.</h2>
              <ul className="auth-points">
                <li>Your course days, notes and revision history, saved to your account.</li>
                <li>Every Debug case you solve or review, with your reports.</li>
                <li>Pick up on any device, right where you left off.</li>
              </ul>
            </div>
            <p className="auth-foot">Free and open. No password to remember.</p>
          </aside>

          <section className="auth-main" aria-labelledby="auth-h">
            <div className="auth-card">
              <h1 id="auth-h">Sign in or create an account</h1>
              {/* useSearchParams (for ?next) needs a Suspense boundary so the page can still prerender. */}
              <Suspense fallback={null}>
                <SignInButtons />
              </Suspense>
              <p className="auth-note">Without an account, everything stays in this browser.</p>
            </div>
          </section>
        </main>
      </AuthGate>
    </Suspense>
  );
}
