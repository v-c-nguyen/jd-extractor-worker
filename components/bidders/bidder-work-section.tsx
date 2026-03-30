"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { dispatchInterviewSchedulingChanged } from "@/lib/interview-scheduling-events";
import type { Bidder, BidderWorkEntry } from "@/lib/bidders/types";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";

type AssignedProfile = { id: string; name: string };

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysUtc(iso: string, delta: number): string {
  const d = new Date(iso + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

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

function aggregateDay(entries: BidderWorkEntry[], iso: string): { bids: number; interviews: number } {
  let bids = 0;
  let interviews = 0;
  for (const e of entries) {
    if (e.workDate === iso) {
      bids += e.bidCount;
      interviews += e.interviewCount;
    }
  }
  return { bids, interviews };
}

export function BidderWorkSection() {
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [biddersLoading, setBiddersLoading] = useState(true);
  const [biddersError, setBiddersError] = useState<string | null>(null);

  const [bidderId, setBidderId] = useState("");
  const [browse, setBrowse] = useState<"daily" | "weekly">("daily");
  const [dailyDate, setDailyDate] = useState(todayIsoUtc);
  const [weekOffset, setWeekOffset] = useState(0);

  const [profiles, setProfiles] = useState<AssignedProfile[]>([]);
  const [entries, setEntries] = useState<BidderWorkEntry[]>([]);
  const [workLoading, setWorkLoading] = useState(false);
  const [workError, setWorkError] = useState<string | null>(null);

  const [counts, setCounts] = useState<Record<string, { bid: number; interview: number }>>({});
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
      const data = (await res.json().catch(() => ({}))) as {
        entries?: BidderWorkEntry[];
        profiles?: AssignedProfile[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setEntries(data.entries ?? []);
      setProfiles(data.profiles ?? []);
    } catch (e) {
      setWorkError(e instanceof Error ? e.message : "Failed to load work log");
      setEntries([]);
      setProfiles([]);
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

  const entriesForDaily = useMemo(
    () => entries.filter((e) => e.workDate === dailyDate),
    [entries, dailyDate]
  );

  useEffect(() => {
    const next: Record<string, { bid: number; interview: number }> = {};
    for (const p of profiles) {
      next[p.id] = { bid: 0, interview: 0 };
    }
    for (const e of entriesForDaily) {
      next[e.profileId] = { bid: e.bidCount, interview: e.interviewCount };
    }
    setCounts(next);
    setSaveError(null);
  }, [dailyDate, profiles, entriesForDaily]);

  const weekMonday = useMemo(() => {
    const shifted = addDaysUtc(todayIsoUtc(), weekOffset * 7);
    return mondayOfWeekContainingIso(shifted);
  }, [weekOffset]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysUtc(weekMonday, i)), [weekMonday]);

  const weekTotals = useMemo(() => {
    let bids = 0;
    let interviews = 0;
    for (const iso of weekDays) {
      const a = aggregateDay(entries, iso);
      bids += a.bids;
      interviews += a.interviews;
    }
    return { bids, interviews };
  }, [weekDays, entries]);

  const dateSummariesDesc = useMemo(() => {
    const m = new Map<string, { bids: number; interviews: number }>();
    for (const e of entries) {
      const cur = m.get(e.workDate) ?? { bids: 0, interviews: 0 };
      cur.bids += e.bidCount;
      cur.interviews += e.interviewCount;
      m.set(e.workDate, cur);
    }
    return [...m.entries()]
      .map(([workDate, v]) => ({ workDate, ...v }))
      .sort((a, b) => (a.workDate < b.workDate ? 1 : a.workDate > b.workDate ? -1 : 0));
  }, [entries]);

  async function saveDaily() {
    if (!bidderId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const rows = profiles.map((p) => {
        const c = counts[p.id] ?? { bid: 0, interview: 0 };
        return {
          profileId: p.id,
          bidCount: clampNonNegInt(c.bid),
          interviewCount: clampNonNegInt(c.interview),
        };
      });
      if (rows.length === 0) {
        setSaveError("No profiles assigned to this bidder.");
        return;
      }
      const res = await fetch(`/api/bidders/${bidderId}/work/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workDate: dailyDate, rows }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      await loadWork(bidderId);
      dispatchInterviewSchedulingChanged();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearDaily() {
    if (!bidderId) return;
    if (!window.confirm(`Remove all work entries for ${formatLong(dailyDate)}?`)) return;
    setSaving(true);
    setSaveError(null);
    try {
      const u = new URL(`/api/bidders/${bidderId}/work`, window.location.origin);
      u.searchParams.set("date", dailyDate);
      const res = await fetch(u.toString(), { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Delete failed (${res.status})`);
      await loadWork(bidderId);
      dispatchInterviewSchedulingChanged();
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
                    One row per assigned profile per day. Totals on performance charts sum all profiles.
                  </p>
                </div>

                <div className="space-y-4">
                  {profiles.length === 0 && !workLoading ? (
                    <p className="text-sm text-muted-foreground">No profiles linked to this bidder yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {profiles.map((p) => {
                        const c = counts[p.id] ?? { bid: 0, interview: 0 };
                        return (
                          <div
                            key={p.id}
                            className="rounded-lg border border-border/70 bg-muted/15 px-3 py-3 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-end sm:gap-3"
                          >
                            <p className="mb-2 text-sm font-medium sm:mb-0">{p.name}</p>
                            <div className="space-y-1.5">
                              <Label className="text-xs" htmlFor={`adm-bid-${p.id}`}>
                                Bids
                              </Label>
                              <Input
                                id={`adm-bid-${p.id}`}
                                type="number"
                                min={0}
                                max={1_000_000}
                                step={1}
                                value={c.bid}
                                onChange={(e) =>
                                  setCounts((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      ...c,
                                      bid: clampNonNegInt(Number.parseInt(e.target.value, 10) || 0),
                                    },
                                  }))
                                }
                                disabled={workLoading || saving}
                              />
                            </div>
                            <div className="mt-3 space-y-1.5 sm:mt-0">
                              <Label className="text-xs" htmlFor={`adm-int-${p.id}`}>
                                Interviews
                              </Label>
                              <Input
                                id={`adm-int-${p.id}`}
                                type="number"
                                min={0}
                                max={1_000_000}
                                step={1}
                                value={c.interview}
                                onChange={(e) =>
                                  setCounts((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      ...c,
                                      interview: clampNonNegInt(Number.parseInt(e.target.value, 10) || 0),
                                    },
                                  }))
                                }
                                disabled={workLoading || saving}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void saveDaily()}
                      disabled={workLoading || saving || profiles.length === 0}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Saving…
                        </>
                      ) : (
                        "Save day"
                      )}
                    </Button>
                    {entriesForDaily.length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => void clearDaily()}
                        disabled={workLoading || saving}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Clear day
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
                ) : dateSummariesDesc.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries yet.</p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/80 p-2">
                    {dateSummariesDesc.map((row) => (
                      <li key={row.workDate}>
                        <button
                          type="button"
                          onClick={() => {
                            setDailyDate(row.workDate);
                            setBrowse("daily");
                          }}
                          className={cn(
                            "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                            row.workDate === dailyDate ? "bg-muted" : "hover:bg-muted/60"
                          )}
                        >
                          <span className="font-medium tabular-nums">{row.workDate}</span>
                          <span className="mt-0.5 block text-muted-foreground">
                            <span className="tabular-nums">{row.bids.toLocaleString()}</span> bids ·{" "}
                            <span className="tabular-nums">{row.interviews.toLocaleString()}</span> interviews
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
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Interview rate</p>
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
                    const a = aggregateDay(entries, iso);
                    const dow = new Date(iso + "T12:00:00.000Z").toLocaleDateString(undefined, {
                      weekday: "long",
                      timeZone: "UTC",
                    });
                    return (
                      <li key={iso} className="rounded-xl border border-border/80 bg-muted/15 p-3 shadow-sm">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {dow}
                          </span>
                          <span className="tabular-nums text-xs text-muted-foreground">{iso}</span>
                        </div>
                        {a.bids > 0 || a.interviews > 0 ? (
                          <>
                            <p className="mt-2 text-sm tabular-nums">
                              <span className="font-medium">{a.bids.toLocaleString()}</span> bids ·{" "}
                              <span className="font-medium">{a.interviews.toLocaleString()}</span> interviews
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
