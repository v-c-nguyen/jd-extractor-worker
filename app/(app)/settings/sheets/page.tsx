"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet } from "lucide-react";

interface SheetEntry {
  spreadsheetId: string;
  sheetName: string;
}

export default function SettingsSheetsPage() {
  const [sheets, setSheets] = useState<SheetEntry[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sheets");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load sheets");
      setSheets(data.sheets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sheets");
      setSheets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Connected sheets"
        description={
          <>
            Google Sheets used by the job extraction pipeline. Configure in{" "}
            <code className="rounded-md border border-border/80 bg-muted/80 px-1.5 py-0.5 font-mono text-[13px]">
              config/sheets.ts
            </code>{" "}
            or via{" "}
            <code className="rounded-md border border-border/80 bg-muted/80 px-1.5 py-0.5 font-mono text-[13px]">
              SHEET_ID
            </code>{" "}
            and{" "}
            <code className="rounded-md border border-border/80 bg-muted/80 px-1.5 py-0.5 font-mono text-[13px]">
              SHEET_TAB
            </code>{" "}
            env vars.
          </>
        }
      />

      {error && (
        <div
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Sheets
          </CardTitle>
          <CardDescription>
            List of spreadsheets and tabs the pipeline reads from and writes to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !sheets || sheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sheets configured.</p>
          ) : (
            <ul className="space-y-3">
              {sheets.map((sheet, i) => (
                <li
                  key={`${sheet.spreadsheetId}-${sheet.sheetName}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-muted/20 px-4 py-4 shadow-sm ring-1 ring-black/[0.02] transition-colors hover:bg-muted/35 dark:ring-white/[0.04]"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium leading-tight">{sheet.sheetName}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{sheet.spreadsheetId}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-background/80 px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border/60">
                    #{i + 1}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
