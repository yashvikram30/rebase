import type { Metadata } from "next";
import "../(debug)/debug.css";
import "./workbench.css";

export const metadata: Metadata = {
  title: { default: "Rebase Debug workbench", template: "%s · Rebase Debug" },
};

// The workbench has no site header or sidebar: it is a full-window editor. `.wb` carries the Debug tokens.
export default function WorkbenchLayout({ children }: LayoutProps<"/">) {
  return <div className="wb">{children}</div>;
}
