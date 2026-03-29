import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bidders",
  description: "Bidder management.",
};

export default function BiddersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
