import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { StriverClient } from "@/components/striver/striver-client";
import { STRIVER_PROBLEMS } from "@/lib/striver-problems";

export const metadata: Metadata = {
  title: "Striver 180 DSA Sheet",
};

export default function StriverPage() {
  return (
    <Suspense fallback={<div className="striver-page striver-loading" role="status" aria-label="Loading your sheet" />}>
      <SignedInSheet />
    </Suspense>
  );
}

/** The sheet's reminders go to the account's address, so the page is for signed-in users only. */
async function SignedInSheet() {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user?.id || !email) redirect("/signin?next=/striver");
  return <StriverClient problems={STRIVER_PROBLEMS} email={email} />;
}
