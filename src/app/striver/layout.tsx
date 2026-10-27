import type { Metadata } from "next";
import { BareShell } from "@/components/bare-shell";
import "./striver.css";

export const metadata: Metadata = {
  title: "Striver 180 SDE Sheet Tracker · Rebase",
  description:
    "Master the 180 core DSA patterns with spaced repetition. Track Green, Yellow, and Red problems with automated daily revision reminders.",
};

export default function StriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <BareShell wide>
      {children}
    </BareShell>
  );
}
