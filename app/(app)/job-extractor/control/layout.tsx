import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pipeline control",
  description: "Start, stop, and maintain the extraction pipeline.",
};

export default function JobExtractorControlLayout({ children }: { children: React.ReactNode }) {
  return children;
}
