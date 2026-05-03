import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AdminDashboardOverview } from "@/components/dashboard/admin-dashboard-overview";
import { BidderDashboardToday } from "@/components/dashboard/bidder-dashboard-today";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeAppRole } from "@/lib/auth/app-role";
import { getUserProfileById } from "@/lib/auth/user-repo";
import { listBidderPerformanceRows } from "@/lib/bidders/performance-repo";
import { listBidderWork } from "@/lib/bidders/work-repo";
import { listInterviewsForDate } from "@/lib/interviews/repo";
import { isPipelineRunning } from "@/lib/pipeline-runtime";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const role = normalizeAppRole(session?.user?.role);

  const utcToday = new Date().toISOString().slice(0, 10);
  let adminOverview: ReactNode = null;
  let bidderOverview: ReactNode = null;
  if (role === "administrator") {
    try {
      const [performance, interviewsToday] = await Promise.all([
        listBidderPerformanceRows(),
        listInterviewsForDate(utcToday),
      ]);
      adminOverview = (
        <AdminDashboardOverview
          pipelineRunning={isPipelineRunning()}
          utcToday={utcToday}
          performance={performance}
          interviewsToday={interviewsToday}
        />
      );
    } catch (err) {
      console.error("[dashboard] admin overview", err);
      adminOverview = (
        <Card className="border-destructive/30 bg-destructive/[0.04] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Administrator overview unavailable</CardTitle>
            <CardDescription>
              Could not load status or today&apos;s data. Check the database connection and migrations.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }
  }
  if (role === "bidder" && session?.user?.id) {
    try {
      const profile = await getUserProfileById(session.user.id);
      if (profile?.bidderId) {
        const entries = await listBidderWork(profile.bidderId, utcToday, utcToday);
        bidderOverview = <BidderDashboardToday utcToday={utcToday} entries={entries} />;
      }
    } catch (err) {
      console.error("[dashboard] bidder today overview", err);
      bidderOverview = (
        <Card className="border-destructive/30 bg-destructive/[0.04] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Your today view is unavailable</CardTitle>
            <CardDescription>Could not load your bidder work for today. Try again shortly.</CardDescription>
          </CardHeader>
        </Card>
      );
    }
  }

  return (
    <div className={cn("mx-auto space-y-8", role === "administrator" ? "max-w-5xl" : "max-w-3xl")}>
      <PageHeader
        eyebrow="Home"
        title="Dashboard"
        description="Overview of today and system status. Open Job extractor, Interviews, and other areas from the top navigation."
      />

      {adminOverview}
      {bidderOverview}
    </div>
  );
}
