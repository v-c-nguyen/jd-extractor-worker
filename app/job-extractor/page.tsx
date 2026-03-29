"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { Play, Square, RotateCw, Loader2, Terminal, SlidersHorizontal } from "lucide-react";

type ExtractorTabId = "control" | "log";

function logLineClass(line: string): string {
  if (line.startsWith("[err]")) return "text-amber-400";
  if (line.startsWith("[sys]")) return "text-sky-400";
  return "text-zinc-200";
}

export default function JobExtractorPage() {
  const [tab, setTab] = useState<ExtractorTabId>("control");
  const [running, setRunning] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const logScrollRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline/status");
      const data = await res.json();
      setRunning(data.running ?? false);
      setError(null);
    } catch {
      setError("Failed to load pipeline status");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline/logs");
      const data = await res.json();
      setLogLines(Array.isArray(data.lines) ? data.lines : []);
      if (typeof data.running === "boolean") {
        setRunning(data.running);
      }
    } catch {
      setError("Failed to load pipeline logs");
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (tab !== "log") return;
    setLogLoading(true);
    void fetchLogs().finally(() => setLogLoading(false));
    const interval = setInterval(fetchLogs, 750);
    return () => clearInterval(interval);
  }, [tab, fetchLogs]);

  useEffect(() => {
    const el = logScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logLines, tab]);

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
      await fetchStatus();
      if (tab === "log") await fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleClearLog() {
    setClearLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Clear failed");
        return;
      }
      setLogLines([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setClearLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Job extractor"
        description="Monitor and control the job extraction pipeline: start, stop, run a single cycle, and inspect live logs."
      />

      <div
        className="flex gap-1 rounded-xl border border-border/80 bg-muted/45 p-1 shadow-inner ring-1 ring-black/[0.02] dark:ring-white/[0.04]"
        role="tablist"
        aria-label="Job extractor"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "control"}
          onClick={() => setTab("control")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
            tab === "control"
              ? "bg-card text-foreground shadow-sm ring-1 ring-border/70"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Control
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "log"}
          onClick={() => setTab("log")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
            tab === "log"
              ? "bg-card text-foreground shadow-sm ring-1 ring-border/70"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
          )}
        >
          <Terminal className="h-4 w-4" aria-hidden />
          Log
        </button>
      </div>

      {tab === "control" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pipeline status
              {loading ? (
                <Skeleton className="h-5 w-20" />
              ) : running !== null ? (
                <Badge variant={running ? "success" : "secondary"}>
                  {running ? "Running" : "Stopped"}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              Start the continuous pipeline, stop it, or run a single cycle (poll → fetch → extract).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              onClick={() => handleAction("start")}
              disabled={running === true || actionLoading !== null}
            >
              {actionLoading === "start" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start pipeline
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAction("stop")}
              disabled={running === false || actionLoading !== null}
            >
              {actionLoading === "stop" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Stop pipeline
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction("run_once")}
              disabled={actionLoading !== null}
            >
              {actionLoading === "run_once" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4" />
              )}
              Run one cycle
            </Button>
          </CardContent>
          {error && (
            <CardContent className="pt-0">
              <div
                className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {tab === "log" && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                Pipeline log
                {loading && !running ? (
                  <Skeleton className="h-5 w-20" />
                ) : running !== null ? (
                  <Badge variant={running ? "success" : "secondary"}>
                    {running ? "Running" : "Stopped"}
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                Stdout and stderr from the pipeline process, like a terminal. Refreshes while this tab is open.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClearLog()}
              disabled={clearLoading || logLoading}
            >
              {clearLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Clear log
            </Button>
          </CardHeader>
          <CardContent>
            <div
              ref={logScrollRef}
              className="max-h-[min(28rem,55vh)] overflow-auto rounded-lg border border-zinc-800/90 bg-zinc-950 px-3 py-3 font-mono text-xs leading-relaxed shadow-inner ring-1 ring-black/20"
            >
              {logLines.length === 0 ? (
                <p className="text-zinc-500">
                  {logLoading ? "Loading…" : "No log lines yet. Start the pipeline or run one cycle."}
                </p>
              ) : (
                logLines.map((line, i) => (
                  <div
                    key={`${i}-${line.slice(0, 24)}`}
                    className={cn("whitespace-pre-wrap break-all", logLineClass(line))}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
            {error && (
              <div
                className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
