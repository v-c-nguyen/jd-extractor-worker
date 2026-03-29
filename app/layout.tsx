import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { DashboardNav } from "@/components/dashboard-nav";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "JD Extractor",
    template: "%s · JD Extractor",
  },
  description: "Dashboard, job extraction pipeline, bidders, and interviews.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="app-surface flex min-h-screen flex-col">
          <DashboardNav />
          <main className="flex-1 px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
