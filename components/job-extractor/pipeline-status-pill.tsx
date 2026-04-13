"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePipelineStatusContext } from "@/components/job-extractor/pipeline-status-context";

export function PipelineStatusPill() {
  const { running, loading, error } = usePipelineStatusContext();

  if (error) {
    return (
      <span
        className="inline-flex max-w-[14rem] items-center rounded-full border border-destructive/30 bg-destructive/[0.06] px-3 py-1.5 text-xs font-medium text-destructive"
        title={error}
      >
        Status unavailable
      </span>
    );
  }

  if (loading) {
    return <Skeleton className="h-8 w-[7.5rem] rounded-full" />;
  }

  if (running === null) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums",
        running
          ? "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-400"
          : "border-border/80 bg-muted/50 text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          running ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]" : "bg-muted-foreground/50"
        )}
        aria-hidden
      />
      {running ? "Running" : "Stopped"}
    </div>
  );
}
