import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MePageClient } from "@/components/account/me-page-client";
import { getUserProfileById } from "@/lib/auth/user-repo";
import { listRecentWorkDateSummaries } from "@/lib/bidders/work-repo";

export const metadata: Metadata = {
  title: "My account",
  description: "Profile, password, and daily work by profile.",
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

  let initialSummaries: { workDate: string; bidCount: number; interviewCount: number }[] = [];
  if (profile.bidderId) {
    try {
      initialSummaries = await listRecentWorkDateSummaries(profile.bidderId, 30);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("DATABASE_URL")) {
        throw err;
      }
      console.error("[me page summaries]", err);
    }
  }

  return <MePageClient profile={profile} initialSummaries={initialSummaries} />;
}
