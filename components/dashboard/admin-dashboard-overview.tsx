import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BidderPerformanceRow } from "@/lib/bidders/performance-types";
import type { Interview } from "@/lib/interviews/types";
import { CalendarClock, Gauge, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  pipelineRunning: boolean;
  utcToday: string;
  performance: BidderPerformanceRow[];
  interviewsToday: Interview[];
};

function sumToday(rows: BidderPerformanceRow[]) {
  let bids = 0;
  let interviews = 0;
  for (const r of rows) {
    bids += r.today.bidCount;
    interviews += r.today.interviewCount;
  }
  return { bids, interviews };
}

export function AdminDashboardOverview({ pipelineRunning, utcToday, performance, interviewsToday }: Props) {
  const totals = sumToday(performance);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Administrator overview</h2>
        <p className="text-sm text-muted-foreground">
          Full operational status and today&apos;s activity. Dates use UTC, consistent with work logs and performance
          metrics.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden />
            System status
          </CardTitle>
          <CardDescription>Job extraction pipeline on this host.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums",
                pipelineRunning
                  ? "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-400"
                  : "border-border/80 bg-muted/50 text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  pipelineRunning
                    ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
                    : "bg-muted-foreground/50"
                )}
                aria-hidden
              />
              {pipelineRunning ? "Pipeline running" : "Pipeline stopped"}
            </span>
            <span className="text-sm text-muted-foreground">
              {pipelineRunning ? "Polling, fetch, and extract cycles are active." : "No pipeline process is assigned."}
            </span>
          </div>
          <Link
            href="/job-extractor/control"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open job extractor
          </Link>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
            Today&apos;s work ({utcToday} UTC)
          </CardTitle>
          <CardDescription>Bids and interviews logged in bidder work entries for today.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Team bids</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{totals.bids.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Team interviews (logged)
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {totals.interviews.toLocaleString()}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Per bidder</p>
            <div className="max-h-80 overflow-auto rounded-md border border-border/80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bidder</TableHead>
                    <TableHead className="text-right tabular-nums">Bids</TableHead>
                    <TableHead className="text-right tabular-nums">Interviews</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No bidders yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    performance.map((row) => (
                      <TableRow key={row.bidderId}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.today.bidCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.today.interviewCount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
            Today&apos;s interview schedule ({utcToday} UTC)
          </CardTitle>
          <CardDescription>Interviews with interview date set to today.</CardDescription>
        </CardHeader>
        <CardContent>
          {interviewsToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interviews scheduled for this date.</p>
          ) : (
            <ul className="divide-y divide-border/80 rounded-md border border-border/80">
              {interviewsToday.map((inv) => (
                <li key={inv.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{inv.profileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {inv.company.trim() ? inv.company : "—"}
                      {inv.interviewType.trim() ? ` · ${inv.interviewType}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-left text-xs text-muted-foreground sm:text-right">
                    <span className="block">{inv.result}</span>
                    {inv.meetingWhere.trim() ? <span className="block">{inv.meetingWhere}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4">
            <Link
              href="/interviews"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Manage interviews
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
