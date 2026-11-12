import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { DrillClient } from "@/components/striver/drill-client";
import { STRIVER_PROBLEMS } from "@/lib/striver-problems";
import "../drill.css";

export const metadata: Metadata = {
  title: "Daily drill · Striver 180",
  description: "Revise problems you have already solved with short recall cards: intuition, brute force, pattern, complexity and pitfalls.",
};

export default function DrillPage() {
  return (
    <Suspense fallback={<div className="striver-page striver-loading" role="status" aria-label="Loading the drill" />}>
      <SignedInDrill />
    </Suspense>
  );
}

/** Progress syncs to the account, so the drill is for signed-in users, like the sheet. */
async function SignedInDrill() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?next=/striver/drill");
  return <DrillClient problems={STRIVER_PROBLEMS} />;
}
