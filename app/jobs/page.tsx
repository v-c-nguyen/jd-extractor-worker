"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import type { JobRow } from "@/lib/sheets-api";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function statusVariant(status: string): "default" | "secondary" | "success" | "warning" | "destructive" {
  const u = status.toUpperCase();
  if (u === "USABLE" || u === "NEW") return "success";
  if (u === "FETCHING" || u === "EXTRACTING" || u === "EXTRACTING_IN_PROGRESS" || u === "FETCHING_IN_PROGRESS") return "warning";
  if (u === "FAILED" || u === "RETRY" || u === "NOT_USABLE") return "destructive";
  return "secondary";
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRow[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load jobs");
      setJobs(data.jobs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const columns: ColumnDef<JobRow>[] = [
    {
      id: "rowNumber",
      header: "Row",
      cell: (row) => (
        <Link
          href={`/jobs/${row.rowNumber}`}
          className="font-medium text-primary hover:underline"
        >
          {row.rowNumber}
        </Link>
      ),
      className: "w-16",
    },
    {
      id: "jobUrl",
      header: "Job URL",
      cell: (row) => (
        <a
          href={row.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-[200px] truncate text-primary hover:underline md:max-w-xs"
        >
          {row.jobUrl}
        </a>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={statusVariant(row.status)}>{row.status || "—"}</Badge>
      ),
      className: "w-32",
    },
    {
      id: "detectedSource",
      header: "Detected source",
      cell: (row) => row.detectedSource ?? "—",
      className: "w-36",
    },
    {
      id: "lastUpdated",
      header: "Last updated",
      cell: (row) =>
        row.lastUpdated
          ? new Date(row.lastUpdated).toLocaleString()
          : "—",
      className: "w-40",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sheet data"
        title="Jobs"
        description="Rows from the connected Google Sheet, with status and links to each job detail view."
      >
        <Button variant="outline" size="sm" className="gap-2 shadow-sm" onClick={fetchJobs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </PageHeader>
      {error && (
        <div
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}
      <DataTable
        columns={columns}
        data={jobs}
        isLoading={loading}
        keyExtractor={(row) => row.rowNumber}
        emptyMessage="No jobs in the sheet."
      />
    </div>
  );
}
