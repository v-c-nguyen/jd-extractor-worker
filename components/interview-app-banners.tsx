"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  INTERVIEW_SCHEDULING_CHANGED_EVENT,
  dispatchInterviewAlertCounts,
} from "@/lib/interview-scheduling-events";
import {
  attachOpenSlotOrdinals,
  formatScheduledDateLabel,
  type OpenInterviewSlot,
} from "@/lib/interviews/scheduling-slots";
import type { StaleBookedInterviewSummary } from "@/lib/interviews/stale-booked";

export function InterviewAppBanners() {
  const [openSlots, setOpenSlots] = useState<OpenInterviewSlot[] | null>(null);
  const [staleBooked, setStaleBooked] = useState<StaleBookedInterviewSummary[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/interviews/scheduling-status");
      const data = (await res.json().catch(() => ({}))) as {
        openSlots?: OpenInterviewSlot[];
        staleBookedInterviews?: StaleBookedInterviewSummary[];
        error?: string;
      };
      if (!res.ok) {
        setOpenSlots([]);
        setStaleBooked([]);
        dispatchInterviewAlertCounts({ staleBooked: 0, openSlots: 0 });
        return;
      }
      const slots = data.openSlots ?? [];
      const stale = data.staleBookedInterviews ?? [];
      setOpenSlots(slots);
      setStaleBooked(stale);
      dispatchInterviewAlertCounts({ staleBooked: stale.length, openSlots: slots.length });
    } catch {
      setOpenSlots([]);
      setStaleBooked([]);
      dispatchInterviewAlertCounts({ staleBooked: 0, openSlots: 0 });
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

  const slotsWithOrdinal = useMemo(
    () => (openSlots === null ? [] : attachOpenSlotOrdinals(openSlots)),
    [openSlots]
  );

  const showScheduling = openSlots !== null && openSlots.length > 0;
  const staleList = staleBooked ?? [];
  const showStale = staleList.length > 0;

  if (!showScheduling && !showStale) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {showScheduling ? (
        <div
          role="alert"
          className="border-b border-amber-500/50 bg-amber-500/15 px-4 py-3 text-amber-950 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-50"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">Interview details are behind the work log</p>
              <p className="mt-1 text-amber-900/85 dark:text-amber-100/90">
                Each interview count in the daily work log needs a matching detail row in Interview management. Open
                items below use the work-log date as the scheduled date for that slot. This banner stays until every
                slot is filled.
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm">
                {slotsWithOrdinal.map((s) => (
                  <li key={`${s.profileId}-${s.workLogSlotIndex}`}>
                    <span className="font-medium text-amber-950 dark:text-amber-50">{s.profileName}</span>
                    <span className="text-amber-900/80 dark:text-amber-100/85">
                      {" "}
                      — scheduled {formatScheduledDateLabel(s.scheduledDate)}
                      {s.groupSize > 1 ? ` (${s.ordinalInGroup}/${s.groupSize} that day)` : ""}
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
      ) : null}

      {showStale ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="border-b border-rose-500/45 bg-rose-500/12 px-4 py-3 text-rose-950 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-50"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">Past interviews still marked Booked</p>
              <p className="mt-1 text-rose-900/90 dark:text-rose-100/90">
                The interview date has passed. Update each row&apos;s result to{" "}
                <span className="font-medium">Completed</span>, <span className="font-medium">Canceled</span>, or{" "}
                <span className="font-medium">Rescheduled</span> — not Booked.
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm">
                {staleList.map((s) => (
                  <li key={s.id}>
                    <span className="font-medium text-rose-950 dark:text-rose-50">{s.profileName}</span>
                    <span className="text-rose-900/85 dark:text-rose-100/85">
                      {" "}
                      — interview {formatScheduledDateLabel(s.interviewDate)}
                      {s.company.trim() ? ` · ${s.company.trim()}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/interviews"
              className="shrink-0 text-sm font-medium text-rose-900 underline underline-offset-4 hover:text-rose-950 dark:text-rose-100 dark:hover:text-white"
            >
              Review interviews
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
