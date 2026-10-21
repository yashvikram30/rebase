import type { Metadata } from "next";
import { ProfilePanel } from "@/components/profile-panel";
import { getCurriculum } from "@/lib/curriculum";
import { planDays } from "@/lib/plan-days";
import "../account.css";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const totalDays = planDays(await getCurriculum()).length;
  return (
    <article>
      <h1>Profile</h1>
      <p className="lead">You, your progress and your account.</p>
      <ProfilePanel totalDays={totalDays} />
    </article>
  );
}
