"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { JobRow } from "@/lib/sheets-api";

function statusVariant(status: string): "default" | "secondary" | "success" | "warning" | "destructive" {
  const u = status.toUpperCase();
  if (u === "USABLE" || u === "NEW") return "success";
  if (u === "FETCHING" || u === "EXTRACTING" || u === "EXTRACTING_IN_PROGRESS" || u === "FETCHING_IN_PROGRESS")
    return "warning";
  if (u === "FAILED" || u === "RETRY" || u === "NOT_USABLE") return "destructive";
  return "secondary";
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3.5 last:border-0 sm:flex-row sm:items-start sm:gap-6">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:w-36 sm:shrink-0">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">{value ?? "—"}</div>
    </div>
  );
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<JobRow | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setJob(data);
        } else {
          setJob(null);
        }
      } catch {
        if (!cancelled) setJob(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (job == null) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <PageHeader title="Job not found" description="This row may have been removed or the ID is invalid." />
        <Button asChild variant="outline" className="shadow-sm">
          <Link href="/jobs">Back to jobs</Link>
        </Button>
      </div>
    );
  }

  const salaryDisplay =
    job.salary ||
    (job.salary_min != null || job.salary_max != null
      ? [job.salary_min, job.salary_max].filter(Boolean).join(" – ") +
        (job.currency ? ` ${job.currency}` : "") +
        (job.salary_period ? ` / ${job.salary_period}` : "")
      : null);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-start gap-3">
        <Button asChild variant="outline" size="icon" className="mt-1 shrink-0 shadow-sm" aria-label="Back to jobs">
          <Link href="/jobs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          eyebrow={`Row ${job.rowNumber}`}
          title="Job detail"
          description="Extracted fields and source link from the sheet row."
          className="min-w-0 flex-1 border-0 pb-0"
        />
      </div>

      <Card>
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Extracted fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <DetailRow label="Company" value={job.company_name} />
          <DetailRow label="Role" value={job.role_title} />
          <DetailRow label="Location" value={job.location} />
          <DetailRow
            label="Tech stack"
            value={
              job.type || job.seniority
                ? [job.type, job.seniority].filter(Boolean).join(" · ")
                : null
            }
          />
          <DetailRow label="Salary" value={salaryDisplay} />
          <DetailRow label="Industry" value={job.industry} />
          <DetailRow label="Work mode" value={job.work_mode} />
          <DetailRow
            label="Status"
            value={<Badge variant={statusVariant(job.status ?? "")}>{job.status || "—"}</Badge>}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          <a
            href={job.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {job.jobUrl}
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">Detected source:</span>{" "}
            {job.detectedSource ?? "—"}
          </p>
          {job.lastUpdated && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">Last updated:</span>{" "}
              {new Date(job.lastUpdated).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
