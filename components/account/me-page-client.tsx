"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dispatchInterviewSchedulingChanged } from "@/lib/interview-scheduling-events";

type AccountProfile = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  bidderId: string | null;
};

type AssignedProfile = { id: string; name: string };

type WorkEntry = {
  id: string;
  profileId: string;
  profileName: string;
  workDate: string;
  bidCount: number;
  interviewCount: number;
};

type DateSummary = { workDate: string; bidCount: number; interviewCount: number };

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clampNonNegInt(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1_000_000, Math.trunc(n));
}

export function MePageClient({
  profile,
  initialSummaries,
}: {
  profile: AccountProfile;
  initialSummaries: DateSummary[];
}) {
  const [summaries, setSummaries] = useState<DateSummary[]>(initialSummaries);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwPending, setPwPending] = useState(false);

  const [workDate, setWorkDate] = useState(localTodayYmd);
  const [assignedProfiles, setAssignedProfiles] = useState<AssignedProfile[]>([]);
  const [counts, setCounts] = useState<Record<string, { bid: number; interview: number }>>({});
  const [workMessage, setWorkMessage] = useState<string | null>(null);
  const [workError, setWorkError] = useState<string | null>(null);
  const [workPending, setWorkPending] = useState(false);
  const [loadPending, setLoadPending] = useState(false);

  const loadDay = useCallback(async (date: string) => {
    setLoadPending(true);
    setWorkError(null);
    setWorkMessage(null);
    try {
      const res = await fetch(`/api/me/daily-work?date=${encodeURIComponent(date)}`);
      const data = (await res.json()) as {
        profiles?: AssignedProfile[];
        entries?: WorkEntry[];
        error?: string;
      };
      if (!res.ok) {
        setWorkError(data.error ?? "Failed to load");
        setAssignedProfiles([]);
        setCounts({});
        return;
      }
      const profs = data.profiles ?? [];
      setAssignedProfiles(profs);
      const next: Record<string, { bid: number; interview: number }> = {};
      for (const p of profs) {
        next[p.id] = { bid: 0, interview: 0 };
      }
      for (const e of data.entries ?? []) {
        next[e.profileId] = { bid: e.bidCount, interview: e.interviewCount };
      }
      setCounts(next);
    } catch {
      setWorkError("Failed to load");
      setAssignedProfiles([]);
      setCounts({});
    } finally {
      setLoadPending(false);
    }
  }, []);

  const refreshSummaries = useCallback(async () => {
    try {
      const res = await fetch("/api/me/daily-work");
      const data = (await res.json()) as { summaries?: DateSummary[] };
      if (res.ok && data.summaries) {
        setSummaries(data.summaries);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!profile.bidderId) return;
    void loadDay(workDate);
  }, [profile.bidderId, workDate, loadDay]);

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);
    setPwError(null);
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    setPwPending(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPwError(data.error ?? "Could not update password");
        return;
      }
      setPwMessage("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPwError("Could not update password");
    } finally {
      setPwPending(false);
    }
  }

  async function onWorkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.bidderId) return;
    setWorkMessage(null);
    setWorkError(null);
    setWorkPending(true);
    try {
      const rows = assignedProfiles.map((p) => {
        const c = counts[p.id] ?? { bid: 0, interview: 0 };
        return {
          profileId: p.id,
          bidCount: clampNonNegInt(c.bid),
          interviewCount: clampNonNegInt(c.interview),
        };
      });
      if (rows.length === 0) {
        setWorkError("No profiles assigned to your bidder.");
        return;
      }
      const res = await fetch("/api/me/daily-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workDate, rows }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setWorkError(data.error ?? "Could not save");
        return;
      }
      setWorkMessage("Saved.");
      await refreshSummaries();
      await loadDay(workDate);
      dispatchInterviewSchedulingChanged();
    } catch {
      setWorkError("Could not save");
    } finally {
      setWorkPending(false);
    }
  }

  const created = new Date(profile.createdAt);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="View your details, change your password, and log daily bids and interviews per assigned profile."
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>Information stored for your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="min-w-[8rem] font-medium text-muted-foreground">Email</span>
            <span className="text-foreground">{profile.email}</span>
          </div>
          {profile.name ? (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <span className="min-w-[8rem] font-medium text-muted-foreground">Name</span>
              <span className="text-foreground">{profile.name}</span>
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="min-w-[8rem] font-medium text-muted-foreground">Member since</span>
            <span className="text-foreground">
              {Number.isNaN(created.getTime()) ? profile.createdAt : created.toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Reset password</CardTitle>
          <CardDescription>Change your password while signed in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onPasswordSubmit} className="space-y-4">
            {pwError ? (
              <p className="text-sm text-destructive" role="alert">
                {pwError}
              </p>
            ) : null}
            {pwMessage ? (
              <p className="text-sm text-primary" role="status">
                {pwMessage}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={pwPending}>
              {pwPending ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Daily work</CardTitle>
          <CardDescription>
            Enter bid count and new interviews scheduled for each profile assigned to your bidder. One row per profile
            per day is stored in the work log.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!profile.bidderId ? (
            <p className="text-sm text-muted-foreground">
              No bidder record points to this login yet. Ask an administrator to set the app user on your bidder row
              (bidders.app_user_id), or run create-user with APP_USER_BIDDER_ID.
            </p>
          ) : (
            <form onSubmit={onWorkSubmit} className="space-y-4">
              {workError ? (
                <p className="text-sm text-destructive" role="alert">
                  {workError}
                </p>
              ) : null}
              {workMessage ? (
                <p className="text-sm text-primary" role="status">
                  {workMessage}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="work-date">Work date</Label>
                <Input
                  id="work-date"
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  required
                />
                {loadPending ? (
                  <p className="text-xs text-muted-foreground">Loading profiles and counts…</p>
                ) : null}
              </div>

              {assignedProfiles.length === 0 && !loadPending ? (
                <p className="text-sm text-muted-foreground">
                  No profiles are assigned to your bidder. Add profiles in the Profiles area and link them to your
                  bidder.
                </p>
              ) : (
                <div className="space-y-4">
                  {assignedProfiles.map((p) => {
                    const c = counts[p.id] ?? { bid: 0, interview: 0 };
                    return (
                      <div
                        key={p.id}
                        className="rounded-lg border border-border/70 bg-muted/15 px-3 py-3 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-end sm:gap-3"
                      >
                        <p className="mb-2 text-sm font-medium text-foreground sm:mb-0">{p.name}</p>
                        <div className="space-y-1.5">
                          <Label className="text-xs" htmlFor={`bid-${p.id}`}>
                            Bids
                          </Label>
                          <Input
                            id={`bid-${p.id}`}
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
                            disabled={loadPending || workPending}
                          />
                        </div>
                        <div className="mt-3 space-y-1.5 sm:mt-0">
                          <Label className="text-xs" htmlFor={`int-${p.id}`}>
                            Interviews
                          </Label>
                          <Input
                            id={`int-${p.id}`}
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
                            disabled={loadPending || workPending}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {assignedProfiles.length > 0 ? (
                <Button type="submit" disabled={workPending || loadPending}>
                  {workPending ? "Saving…" : "Save daily work"}
                </Button>
              ) : null}
            </form>
          )}

          {profile.bidderId && summaries.length > 0 ? (
            <div className="border-t border-border/70 pt-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Recent days (totals)</h3>
              <ul className="space-y-2">
                {summaries.slice(0, 14).map((s) => (
                  <li
                    key={s.workDate}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                  >
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                      onClick={() => setWorkDate(s.workDate)}
                    >
                      {s.workDate}
                    </button>
                    <span className="tabular-nums text-muted-foreground">
                      {s.bidCount.toLocaleString()} bids · {s.interviewCount.toLocaleString()} interviews
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
