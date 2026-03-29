import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Home and shortcuts to job extractor, bidders, interviews, jobs, and sheets.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
