"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Bidder, BidderWorkEntry } from "@/lib/bidders/types";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysUtc(iso: string, delta: number): string {
  const d = new Date(iso + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Monday (UTC) of the calendar week containing `iso` (YYYY-MM-DD). */
function mondayOfWeekContainingIso(iso: string): string {
  const d = new Date(iso + "T12:00:00.000Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatLong(iso: string): string {
  const d = new Date(iso + "T12:00:00.000Z");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function rangeForHistory(): { from: string; to: string } {
  const to = todayIsoUtc();
  const from = addDaysUtc(to, -370);
  return { from, to };
}

function clampNonNegInt(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1_000_000, Math.trunc(n));
}

function interviewRateLabel(totalBids: number, totalInterviews: number): string {
  if (totalBids === 0) return "—";
  return `${((totalInterviews / totalBids) * 100).toFixed(1)}%`;
}

export function BidderWorkSection() {
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [biddersLoading, setBiddersLoading] = useState(true);
  const [biddersError, setBiddersError] = useState<string | null>(null);

  const [bidderId, setBidderId] = useState("");
  const [browse, setBrowse] = useState<"daily" | "weekly">("daily");
  const [dailyDate, setDailyDate] = useState(todayIsoUtc);
  const [weekOffset, setWeekOffset] = useState(0);

  const [entries, setEntries] = useState<BidderWorkEntry[]>([]);
  const [workLoading, setWorkLoading] = useState(false);
  const [workError, setWorkError] = useState<string | null>(null);

  const [bidCount, setBidCount] = useState(0);
  const [interviewCount, setInterviewCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadBidders = useCallback(async () => {
    setBiddersLoading(true);
    setBiddersError(null);
    try {
      const res = await fetch("/api/bidders");
      const data = (await res.json().catch(() => ({}))) as { bidders?: Bidder[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setBidders(data.bidders ?? []);
    } catch (e) {
      setBiddersError(e instanceof Error ? e.message : "Failed to load bidders");
      setBidders([]);
    } finally {
      setBiddersLoading(false);
    }
  }, []);

  const loadWork = useCallback(async (id: string) => {
    if (!id) return;
    setWorkLoading(true);
    setWorkError(null);
    try {
      const { from, to } = rangeForHistory();
      const u = new URL(`/api/bidders/${id}/work`, window.location.origin);
      u.searchParams.set("from", from);
      u.searchParams.set("to", to);
      const res = await fetch(u.toString());
      const data = (await res.json().catch(() => ({}))) as { entries?: BidderWorkEntry[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setEntries(data.entries ?? []);
    } catch (e) {
      setWorkError(e instanceof Error ? e.message : "Failed to load work log");
      setEntries([]);
    } finally {
      setWorkLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBidders();
  }, [loadBidders]);

  useEffect(() => {
    if (bidderId) void loadWork(bidderId);
  }, [bidderId, loadWork]);

  const byDate = useMemo(() => {
    const m = new Map<string, BidderWorkEntry>();
    for (const e of entries) {
      m.set(e.workDate, e);
    }
    return m;
  }, [entries]);

  const entryForDaily = byDate.get(dailyDate);

  useEffect(() => {
    setBidCount(entryForDaily?.bidCount ?? 0);
    setInterviewCount(entryForDaily?.interviewCount ?? 0);
    setSaveError(null);
  }, [dailyDate, entryForDaily?.id, entryForDaily?.bidCount, entryForDaily?.interviewCount]);

  const weekMonday = useMemo(() => {
    const shifted = addDaysUtc(todayIsoUtc(), weekOffset * 7);
    return mondayOfWeekContainingIso(shifted);
  }, [weekOffset]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysUtc(weekMonday, i)), [weekMonday]);

  const weekTotals = useMemo(() => {
    let bids = 0;
    let interviews = 0;
    for (const iso of weekDays) {
      const e = byDate.get(iso);
      if (e) {
        bids += e.bidCount;
        interviews += e.interviewCount;
      }
    }
    return { bids, interviews };
  }, [weekDays, byDate]);

  const sortedEntriesDesc = useMemo(
    () => [...entries].sort((a, b) => (a.workDate < b.workDate ? 1 : a.workDate > b.workDate ? -1 : 0)),
    [entries]
  );

  async function saveDaily() {
    if (!bidderId) return;
    const b = clampNonNegInt(bidCount);
    const inv = clampNonNegInt(interviewCount);
    setSaving(true);
    setSaveError(null);
    try {
      if (entryForDaily) {
        const res = await fetch(`/api/bidders/${bidderId}/work/${entryForDaily.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bidCount: b, interviewCount: inv }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Update failed (${res.status})`);
      } else {
        const res = await fetch(`/api/bidders/${bidderId}/work`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workDate: dailyDate, bidCount: b, interviewCount: inv }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Create failed (${res.status})`);
      }
      await loadWork(bidderId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeDaily() {
    if (!bidderId || !entryForDaily) return;
    if (!window.confirm(`Remove work log for ${formatLong(dailyDate)}?`)) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/bidders/${bidderId}/work/${entryForDaily.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Delete failed (${res.status})`);
      }
      setBidCount(0);
      setInterviewCount(0);
      await loadWork(bidderId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {biddersError ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {biddersError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="work-bidder">Bidder</Label>
          <select
            id="work-bidder"
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            value={bidderId}
            onChange={(e) => setBidderId(e.target.value)}
            disabled={biddersLoading}
          >
            <option value="">{biddersLoading ? "Loading…" : "Select a bidder"}</option>
            {bidders.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex rounded-lg border border-border/80 bg-muted/30 p-1">
          {(
            [
              ["daily", "Daily"],
              ["weekly", "Weekly"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setBrowse(id)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                browse === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!bidderId ? (
        <p className="text-sm text-muted-foreground">Choose a bidder to view and edit their work history.</p>
      ) : workError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {workError}
        </p>
      ) : (
        <>
          {browse === "daily" ? (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="work-date" className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 opacity-70" aria-hidden />
                      Date
                    </Label>
                    <Input
                      id="work-date"
                      type="date"
                      value={dailyDate}
                      onChange={(e) => setDailyDate(e.target.value)}
                      disabled={workLoading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    One row per calendar day: bids completed that day and interviews newly scheduled that day.
                    Save updates the selected date; remove deletes that row.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="work-bid-count">Bid count</Label>
                      <Input
                        id="work-bid-count"
                        type="number"
                        min={0}
                        max={1_000_000}
                        step={1}
                        value={bidCount}
                        onChange={(e) => setBidCount(clampNonNegInt(Number.parseInt(e.target.value, 10) || 0))}
                        disabled={workLoading || saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="work-interview-count">New interviews scheduled</Label>
                      <Input
                        id="work-interview-count"
                        type="number"
                        min={0}
                        max={1_000_000}
                        step={1}
                        value={interviewCount}
                        onChange={(e) =>
                          setInterviewCount(clampNonNegInt(Number.parseInt(e.target.value, 10) || 0))
                        }
                        disabled={workLoading || saving}
                      />
                    </div>
                  </div>
                  {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void saveDaily()} disabled={workLoading || saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Saving…
                        </>
                      ) : entryForDaily ? (
                        "Save changes"
                      ) : (
                        "Add entry"
                      )}
                    </Button>
                    {entryForDaily ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => void removeDaily()}
                        disabled={workLoading || saving}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Day history (newest first)</h3>
                {workLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </p>
                ) : sortedEntriesDesc.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries yet. Add one for the selected date.</p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/80 p-2">
                    {sortedEntriesDesc.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setDailyDate(e.workDate);
                            setBrowse("daily");
                          }}
                          className={cn(
                            "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                            e.workDate === dailyDate ? "bg-muted" : "hover:bg-muted/60"
                          )}
                        >
                          <span className="font-medium tabular-nums">{e.workDate}</span>
                          <span className="mt-0.5 block text-muted-foreground">
                            <span className="tabular-nums">{e.bidCount.toLocaleString()}</span> bids ·{" "}
                            <span className="tabular-nums">{e.interviewCount.toLocaleString()}</span> interviews
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">Week overview</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatLong(weekDays[0]!)} – {formatLong(weekDays[6]!)} (Mon–Sun, UTC)
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Previous week"
                    onClick={() => setWeekOffset((w) => w - 1)}
                    disabled={workLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWeekOffset(0)}
                    disabled={workLoading || weekOffset === 0}
                  >
                    This week
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Next week"
                    onClick={() => setWeekOffset((w) => w + 1)}
                    disabled={workLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Week total bids</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                    {workLoading ? "…" : weekTotals.bids.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Week total interviews
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                    {workLoading ? "…" : weekTotals.interviews.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Interview rate
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                    {workLoading ? "…" : interviewRateLabel(weekTotals.bids, weekTotals.interviews)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">interviews ÷ bids × 100%</p>
                </div>
              </div>

              {workLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading…
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {weekDays.map((iso) => {
                    const ent = byDate.get(iso);
                    const dow = new Date(iso + "T12:00:00.000Z").toLocaleDateString(undefined, {
                      weekday: "long",
                      timeZone: "UTC",
                    });
                    return (
                      <li
                        key={iso}
                        className="rounded-xl border border-border/80 bg-muted/15 p-3 shadow-sm"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {dow}
                          </span>
                          <span className="tabular-nums text-xs text-muted-foreground">{iso}</span>
                        </div>
                        {ent ? (
                          <>
                            <p className="mt-2 text-sm tabular-nums">
                              <span className="font-medium">{ent.bidCount.toLocaleString()}</span> bids ·{" "}
                              <span className="font-medium">{ent.interviewCount.toLocaleString()}</span> interviews
                            </p>
                            <Button
                              type="button"
                              variant="link"
                              className="mt-2 h-auto p-0 text-xs"
                              onClick={() => {
                                setDailyDate(iso);
                                setBrowse("daily");
                              }}
                            >
                              Edit in daily view
                            </Button>
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">No entry</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
