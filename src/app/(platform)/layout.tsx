import { SiteHeader } from "@/components/site-header";

// The marketing home: a simple top bar, no app sidebar. Everything past this page lives in the app shell.
export default function PlatformLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="site">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
