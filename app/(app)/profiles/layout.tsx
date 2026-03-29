import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profiles",
  description: "Manage people profiles linked to bidders.",
};

export default function ProfilesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
