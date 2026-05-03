import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BidderWorkEntry } from "@/lib/bidders/types";

type Props = {
  utcToday: string;
  entries: BidderWorkEntry[];
};

function sum(entries: BidderWorkEntry[]): { bids: number; interviews: number } {
  let bids = 0;
  let interviews = 0;
  for (const e of entries) {
    bids += e.bidCount;
    interviews += e.interviewCount;
  }
  return { bids, interviews };
}

export function BidderDashboardToday({ utcToday, entries }: Props) {
  const totals = sum(entries);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your work today ({utcToday} UTC)</CardTitle>
        <CardDescription>Your bids and interview counts for today only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total bids</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{totals.bids.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Total interviews
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {totals.interviews.toLocaleString()}
            </p>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No work log rows saved for today yet.</p>
        ) : (
          <div className="overflow-auto rounded-md border border-border/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile</TableHead>
                  <TableHead className="text-right tabular-nums">Bids</TableHead>
                  <TableHead className="text-right tabular-nums">Interviews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.profileName}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.bidCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.interviewCount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p>
          <Link href="/me" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Update your daily work
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
