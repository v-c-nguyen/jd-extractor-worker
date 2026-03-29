"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BidderPerformanceRow, PeriodPerformance, WeeklyTeamRatePoint } from "@/lib/bidders/performance-types";

type PerformancePayload = {
  bidders?: BidderPerformanceRow[];
  weeklyHistory?: WeeklyTeamRatePoint[];
  error?: string;
};

function formatRate(pct: number | null): string {
  if (pct === null) return "—";
  return `${pct.toFixed(1)}%`;
}

function formatWeekLabel(start: string, end: string): string {
  const a = new Date(start + "T12:00:00.000Z");
  const b = new Date(end + "T12:00:00.000Z");
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  return `${a.toLocaleDateString(undefined, o)} – ${b.toLocaleDateString(undefined, o)}`;
}

function PeriodBlock({ label, p }: { label: string; p: PeriodPerformance }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-3 tabular-nums">
          <dt className="text-muted-foreground">Interviews</dt>
          <dd className="font-medium">{p.interviewCount.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between gap-3 tabular-nums">
          <dt className="text-muted-foreground">Bids</dt>
          <dd className="font-medium">{p.bidCount.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between gap-3 tabular-nums">
          <dt className="text-muted-foreground">Rate</dt>
          <dd className="font-medium">{formatRate(p.interviewRatePct)}</dd>
        </div>
      </dl>
      <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">Rate = interviews ÷ bids × 100%</p>
    </div>
  );
}

export function BidderPerformanceSection() {
  const [bidders, setBidders] = useState<BidderPerformanceRow[]>([]);
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklyTeamRatePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bidders/performance");
      const data = (await res.json().catch(() => ({}))) as PerformancePayload;
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setBidders(data.bidders ?? []);
      setWeeklyHistory(data.weeklyHistory ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load performance");
      setBidders([]);
      setWeeklyHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxRate = Math.max(
    1,
    ...weeklyHistory.map((w) => (w.interviewRatePct !== null ? w.interviewRatePct : 0))
  );
  const BAR_MAX_PX = 104;

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading performance…
        </p>
      ) : bidders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bidders yet. Add bidders and work entries to see metrics.</p>
      ) : (
        <ul className="space-y-4">
          {bidders.map((row) => (
            <li
              key={row.bidderId}
              className="rounded-xl border border-border/80 bg-muted/10 p-4 shadow-sm"
            >
              <h3 className="text-sm font-semibold leading-none">{row.name}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <PeriodBlock label="Today (UTC)" p={row.today} />
                <PeriodBlock label="This week (Mon–Sun, UTC)" p={row.week} />
                <PeriodBlock label="This month (UTC)" p={row.month} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-border/80 bg-muted/10 p-4 shadow-sm">
        <h3 className="text-sm font-semibold">Recent 5 weeks — team interview rate</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Combined bids and interviews across all bidders, by calendar week (Mon–Sun, UTC). Oldest to newest, left to
          right.
        </p>
        {error ? (
          <p className="mt-4 text-sm text-muted-foreground">See message above — weekly history did not load.</p>
        ) : loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : weeklyHistory.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No weekly data yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div
              className="flex items-end justify-between gap-1.5 sm:gap-3"
              style={{ minHeight: BAR_MAX_PX + 56 }}
              role="img"
              aria-label="Weekly interview rate bars"
            >
              {weeklyHistory.map((w) => {
                const pct = w.interviewRatePct;
                const barPx =
                  pct === null ? 5 : Math.max(8, Math.round((pct / maxRate) * BAR_MAX_PX));
                return (
                  <div key={w.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      {formatRate(pct)}
                    </span>
                    <div
                      className="flex w-full max-w-[5rem] flex-col justify-end sm:max-w-none"
                      style={{ height: BAR_MAX_PX }}
                      title={`${w.bidCount.toLocaleString()} bids, ${w.interviewCount.toLocaleString()} interviews`}
                    >
                      <div
                        className={cn(
                          "w-full rounded-t-md transition-colors",
                          pct === null ? "bg-muted-foreground/25" : "bg-primary/85"
                        )}
                        style={{ height: barPx }}
                      />
                    </div>
                    <span className="max-w-full truncate text-center text-[10px] leading-tight text-muted-foreground">
                      {formatWeekLabel(w.weekStart, w.weekEnd)}
                    </span>
                  </div>
                );
              })}
            </div>
            <ul className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-5">
              {weeklyHistory.map((w) => (
                <li key={`${w.weekStart}-legend`} className="rounded-md border border-border/60 bg-background/50 px-2 py-1.5">
                  <span className="font-medium text-foreground">{formatRate(w.interviewRatePct)}</span>
                  <span className="mt-0.5 block tabular-nums">
                    {w.interviewCount.toLocaleString()} int · {w.bidCount.toLocaleString()} bids
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
