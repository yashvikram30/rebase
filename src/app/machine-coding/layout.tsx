import type { Metadata } from "next";
import { BareShell } from "@/components/bare-shell";
import "../striver/striver.css";
import "./machine-coding.css";

export const metadata: Metadata = {
  title: "Machine Coding · Rebase",
  description:
    "A level-by-level machine coding course: OOP, SOLID, design patterns, concurrency and 31 timed problems, with progress you can see.",
};

export default function MachineCodingLayout({ children }: { children: React.ReactNode }) {
  return <BareShell wide>{children}</BareShell>;
}
