import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings-panel";
import "../account.css";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <article>
      <h1>Settings</h1>
      <p className="lead">Your plan, how Rebase looks, and your data.</p>
      <SettingsPanel />
    </article>
  );
}
