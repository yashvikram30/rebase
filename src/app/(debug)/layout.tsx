import type { Metadata } from "next";
import { BareShell } from "@/components/bare-shell";

export const metadata: Metadata = {
  title: { default: "Rebase Debug: practice the AI-enabled debugging round", template: "%s · Rebase Debug" },
  description:
    "Practice the AI-enabled debugging interview: find the bug, review what an agent did, and learn what to do better.",
};

export default function DebugLayout({ children }: LayoutProps<"/">) {
  return (
    <BareShell product="debug" wide>
      {children}
    </BareShell>
  );
}
