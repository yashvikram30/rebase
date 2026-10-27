import type { Metadata } from "next";
import { Suspense } from "react";
import rawProblems from "@/data/striver-180.json";
import { StriverClient } from "@/components/striver/striver-client";
import type { StriverProblem } from "@/lib/striver-types";

export const metadata: Metadata = {
  title: "Striver 180 DSA Sheet",
};

export default function StriverPage() {
  const problems = rawProblems as StriverProblem[];
  return (
    <Suspense fallback={<div aria-busy="true" style={{ padding: "40px", textAlign: "center" }}>Loading sheet...</div>}>
      <StriverClient problems={problems} />
    </Suspense>
  );
}
