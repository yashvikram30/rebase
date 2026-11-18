import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { MachineCodingClient } from "@/components/machine-coding/machine-coding-client";

export const metadata: Metadata = {
  title: "Machine Coding course",
};

export default function MachineCodingPage() {
  return (
    <Suspense fallback={<div className="mc-page mc-loading" role="status" aria-label="Loading the course" />}>
      <SignedInCourse />
    </Suspense>
  );
}

/** Progress is saved to the account, like the Striver sheet, so the course is for signed-in users. */
async function SignedInCourse() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?next=/machine-coding");
  return <MachineCodingClient />;
}
