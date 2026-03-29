import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth-session-provider";

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
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
