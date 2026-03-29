import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interviews",
  description: "Interview management.",
};

export default function InterviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
