import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MePageClient } from "@/components/account/me-page-client";
import {
  getUserProfileById,
  listRecentDailyReports,
  type DailyReportRow,
} from "@/lib/auth/user-repo";

export const metadata: Metadata = {
  title: "My account",
  description: "Profile, password, and daily reports.",
};

export default async function MePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/signin");
  }

  let profile;
  try {
    profile = await getUserProfileById(userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("DATABASE_URL")) {
      throw err;
    }
    console.error("[me page]", err);
    redirect("/signin");
  }

  if (!profile) {
    redirect("/signin");
  }

  let initialReports: DailyReportRow[];
  try {
    initialReports = await listRecentDailyReports(userId, 30);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("DATABASE_URL")) {
      throw err;
    }
    console.error("[me page reports]", err);
    initialReports = [];
  }

  return <MePageClient profile={profile} initialReports={initialReports} />;
}
