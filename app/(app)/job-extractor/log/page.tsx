"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";

function logLineClass(line: string): string {
  if (line.startsWith("[err]")) return "text-amber-400";
  if (line.startsWith("[sys]")) return "text-sky-400";
  return "text-zinc-200";
}

export default function JobExtractorLogPage() {
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline/logs");
      const data = await res.json();
      setLogLines(Array.isArray(data.lines) ? data.lines : []);
      setError(null);
    } catch {
      setError("Failed to load pipeline logs");
    }
  }, []);

  useEffect(() => {
    setLogLoading(true);
    void fetchLogs().finally(() => setLogLoading(false));
    const interval = setInterval(fetchLogs, 750);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    const el = logScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logLines]);

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
    <Card className="overflow-hidden shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      <CardHeader className="flex flex-col gap-4 space-y-0 border-b border-border/60 bg-muted/20 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-lg">Live output</CardTitle>
          <CardDescription className="text-[13px] leading-relaxed">
            Stdout and stderr from the worker. This page polls the log endpoint while it is open.
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-border/80 bg-background/50"
            onClick={() => void handleClearLog()}
            disabled={clearLoading || logLoading}
          >
            {clearLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Clear log
          </Button>
          <p className="text-right text-[11px] tabular-nums text-muted-foreground">
            {logLines.length} line{logLines.length === 1 ? "" : "s"}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div
          ref={logScrollRef}
          className="max-h-[min(26rem,52vh)] overflow-auto rounded-lg border border-border/80 bg-zinc-950 px-3 py-3 font-mono text-[12px] leading-[1.55] text-zinc-200 shadow-inner ring-1 ring-black/15 dark:border-zinc-800/90"
        >
          {logLines.length === 0 ? (
            <p className="text-zinc-500">
              {logLoading ? "Loading…" : "No output yet. Start the pipeline or run one cycle from Control."}
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
        {error ? (
          <div
            className="mt-4 flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-sm text-destructive"
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
