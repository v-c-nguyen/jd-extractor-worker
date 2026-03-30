"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { INTERVIEW_SCHEDULING_CHANGED_EVENT } from "@/lib/interview-scheduling-events";

type Gap = {
  profileId: string;
  profileName: string;
  scheduledCount: number;
  enteredCount: number;
  remaining: number;
};

export function InterviewSchedulingBanner() {
  const [gaps, setGaps] = useState<Gap[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/interviews/scheduling-status");
      const data = (await res.json().catch(() => ({}))) as {
        gaps?: Gap[];
        error?: string;
      };
      if (!res.ok) {
        setGaps([]);
        return;
      }
      setGaps(data.gaps ?? []);
    } catch {
      setGaps([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 45_000);
    const onChange = () => void load();
    window.addEventListener(INTERVIEW_SCHEDULING_CHANGED_EVENT, onChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener(INTERVIEW_SCHEDULING_CHANGED_EVENT, onChange);
    };
  }, [load]);

  if (gaps === null || gaps.length === 0) {
    return null;
  }

  return (
    <div
      role="alert"
      className="border-b border-amber-500/50 bg-amber-500/15 px-4 py-3 text-amber-950 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-50"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">Interview details are behind the work log</p>
          <p className="mt-1 text-amber-900/85 dark:text-amber-100/90">
            For each profile, the number of rows in Interview management should match the sum of interview counts from
            the daily work log (<code className="rounded bg-black/5 px-1 dark:bg-white/10">bidder_work_entries</code>).
            Add interview details until the counts match. This banner stays until every profile is caught up.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm">
            {gaps.map((g) => (
              <li key={g.profileId}>
                <span className="font-medium text-amber-950 dark:text-amber-50">{g.profileName}</span>
                <span className="text-amber-900/80 dark:text-amber-100/85">
                  {" "}
                  — {g.remaining} more detail row{g.remaining === 1 ? "" : "s"} needed ({g.enteredCount}/
                  {g.scheduledCount} work-log total)
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Link
          href="/interviews"
          className="shrink-0 text-sm font-medium text-amber-900 underline underline-offset-4 hover:text-amber-950 dark:text-amber-100 dark:hover:text-white"
        >
          Go to interviews
        </Link>
      </div>
    </div>
  );
}
