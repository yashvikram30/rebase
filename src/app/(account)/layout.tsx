import { BareShell } from "@/components/bare-shell";

// Profile and settings belong to the platform, not to one offering. The sidebar links to both products.
export default function AccountLayout({ children }: LayoutProps<"/">) {
  return <BareShell>{children}</BareShell>;
}
