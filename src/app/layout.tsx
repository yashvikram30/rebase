import type { Metadata } from "next";
import { Suspense } from "react";
import { Bricolage_Grotesque, DM_Mono, DM_Sans } from "next/font/google";
import { PageViewTracker } from "@/components/page-view-tracker";
import { SyncManager } from "@/components/sync-manager";
import { Toaster } from "@/components/toaster";
import "./globals.css";
import "./theme.css";
import "./motion.css";
import "./focus.css";

// Bricolage Grotesque for headings, DM Sans for text and UI, DM Mono for code and test names.
const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"] });
const mono = DM_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

// Platform-level only. Each offering (the (learn), (debug) and (account) route groups) brings its own
// shell and metadata; what is shared is sign-in, sync, theme and the global styles.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://daybookcs.vercel.app"),
  title: { default: "Rebase", template: "%s · Rebase" },
  description: "Rebase: learn how computers really work, and practice the AI-enabled debugging round.",
  openGraph: { type: "website", siteName: "Rebase" },
  twitter: { card: "summary_large_image" },
};

// Runs before paint so the saved theme never flashes.
const themeScript = `try{var t=localStorage.getItem("csplan.theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <SyncManager>
          {children}
          <Toaster />
        </SyncManager>
      </body>
    </html>
  );
}
