import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job extractor",
  description: "Control and monitor the job extraction pipeline.",
};

export default function JobExtractorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
