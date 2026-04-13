import type { Metadata } from "next";
import { JobExtractorSectionShell } from "@/components/job-extractor/job-extractor-section-shell";

export const metadata: Metadata = {
  title: "Job extractor",
  description: "Control and monitor the job extraction pipeline.",
};

export default function JobExtractorLayout({ children }: { children: React.ReactNode }) {
  return <JobExtractorSectionShell>{children}</JobExtractorSectionShell>;
}
