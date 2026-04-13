"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePipelineStatusContext } from "@/components/job-extractor/pipeline-status-context";
import {
  Play,
  Square,
  RotateCw,
  Loader2,
  Trash2,
  AlertCircle,
} from "lucide-react";

export default function JobExtractorControlPage() {
  const { running, refresh } = usePipelineStatusContext();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetLocalLoading, setResetLocalLoading] = useState(false);

  async function handleAction(action: "start" | "stop" | "run_once") {
    setActionLoading(action);
    setError(null);
    try {
      const res = await fetch("/api/pipeline/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Request failed");
        return;
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResetLocalState() {
    if (
      !window.confirm(
        "Remove all cached JD text files (cache/*.txt) and clear the deduplication hash list (data/jd_hashes.json)? The next runs will re-fetch and may re-extract previously seen postings."
      )
    ) {
      return;
    }
    setResetLocalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline/local-reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Reset failed");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetLocalLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      <CardHeader className="space-y-1 border-b border-border/60 bg-muted/20 pb-5">
        <CardTitle className="text-lg">Pipeline</CardTitle>
        <CardDescription className="text-[13px] leading-relaxed">
          Continuous mode polls, fetches, and extracts on a schedule. One cycle runs that sequence once. Reset clears
          cached JD text and dedupe hashes—stop the pipeline first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Runtime</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="h-10 w-full justify-center gap-2 sm:justify-start"
              onClick={() => handleAction("start")}
              disabled={running === true || actionLoading !== null}
            >
              {actionLoading === "start" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Play className="h-4 w-4 shrink-0" />
              )}
              Start pipeline
            </Button>
            <Button
              variant="destructive"
              className="h-10 w-full justify-center gap-2 sm:justify-start"
              onClick={() => handleAction("stop")}
              disabled={running === false || actionLoading !== null}
            >
              {actionLoading === "stop" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Square className="h-4 w-4 shrink-0" />
              )}
              Stop pipeline
            </Button>
          </div>
        </div>

        <div className="h-px bg-border/70" aria-hidden />

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Maintenance</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-10 w-full justify-center gap-2 border-border/80 bg-background/50 sm:justify-start"
              onClick={() => handleAction("run_once")}
              disabled={actionLoading !== null}
            >
              {actionLoading === "run_once" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4 shrink-0" />
              )}
              Run one cycle
            </Button>
            <Button
              variant="outline"
              className="h-10 w-full justify-center gap-2 border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive sm:justify-start"
              onClick={() => void handleResetLocalState()}
              disabled={running === true || actionLoading !== null || resetLocalLoading}
              title={
                running === true
                  ? "Stop the pipeline before clearing local caches and hashes."
                  : undefined
              }
            >
              {resetLocalLoading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 shrink-0" />
              )}
              Reset local state
            </Button>
          </div>
        </div>

        {error ? (
          <div
            className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="leading-snug">{error}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
