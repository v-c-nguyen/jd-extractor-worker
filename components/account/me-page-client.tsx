"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
};

type ReportRow = {
  id: string;
  report_date: string;
  body: string;
  updated_at: string;
};

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MePageClient({
  profile,
  initialReports,
}: {
  profile: Profile;
  initialReports: ReportRow[];
}) {
  const [reports, setReports] = useState<ReportRow[]>(initialReports);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwPending, setPwPending] = useState(false);

  const [reportDate, setReportDate] = useState(localTodayYmd);
  const [reportBody, setReportBody] = useState("");
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportPending, setReportPending] = useState(false);
  const [loadPending, setLoadPending] = useState(false);

  const loadReportForDate = useCallback(async (date: string) => {
    setLoadPending(true);
    setReportError(null);
    setReportMessage(null);
    try {
      const res = await fetch(`/api/me/daily-report?date=${encodeURIComponent(date)}`);
      const data = (await res.json()) as { report?: ReportRow | null; error?: string };
      if (!res.ok) {
        setReportError(data.error ?? "Failed to load report");
        setReportBody("");
        return;
      }
      setReportBody(data.report?.body ?? "");
    } catch {
      setReportError("Failed to load report");
      setReportBody("");
    } finally {
      setLoadPending(false);
    }
  }, []);

  useEffect(() => {
    void loadReportForDate(reportDate);
  }, [reportDate, loadReportForDate]);

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

  async function onReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setReportMessage(null);
    setReportError(null);
    setReportPending(true);
    try {
      const res = await fetch("/api/me/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportDate, body: reportBody }),
      });
      const data = (await res.json()) as { report?: ReportRow; error?: string };
      if (!res.ok) {
        setReportError(data.error ?? "Could not save report");
        return;
      }
      if (data.report) {
        setReports((prev) => {
          const rest = prev.filter((r) => r.report_date !== data.report!.report_date);
          return [data.report!, ...rest].sort((a, b) => (a.report_date < b.report_date ? 1 : -1));
        });
      }
      setReportMessage("Report saved.");
    } catch {
      setReportError("Could not save report");
    } finally {
      setReportPending(false);
    }
  }

  const created = new Date(profile.createdAt);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="View your details, change your password, and submit daily reports."
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
          <CardTitle className="text-lg">Daily report</CardTitle>
          <CardDescription>One entry per day; saving overwrites the text for that date.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={onReportSubmit} className="space-y-4">
            {reportError ? (
              <p className="text-sm text-destructive" role="alert">
                {reportError}
              </p>
            ) : null}
            {reportMessage ? (
              <p className="text-sm text-primary" role="status">
                {reportMessage}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="report-date">Report date</Label>
              <Input
                id="report-date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                required
              />
              {loadPending ? (
                <p className="text-xs text-muted-foreground">Loading entry for this date…</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-body">What did you work on today?</Label>
              <textarea
                id="report-body"
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[140px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={reportBody}
                onChange={(e) => setReportBody(e.target.value)}
                placeholder="Summarize progress, blockers, and next steps."
                required
              />
            </div>
            <Button type="submit" disabled={reportPending || loadPending}>
              {reportPending ? "Saving…" : "Save report"}
            </Button>
          </form>

          {reports.length > 0 ? (
            <div className="border-t border-border/70 pt-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Recent reports</h3>
              <ul className="space-y-3">
                {reports.slice(0, 14).map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-foreground">{r.report_date}</p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                      {r.body}
                    </p>
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
