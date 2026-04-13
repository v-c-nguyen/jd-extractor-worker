import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pipeline log",
  description: "Live stdout and stderr from the extraction worker.",
};

export default function JobExtractorLogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
