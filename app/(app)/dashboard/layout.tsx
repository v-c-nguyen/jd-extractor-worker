import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Home overview; use the top navigation for job extractor, bidders, profiles, interviews, jobs, and sheets.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
