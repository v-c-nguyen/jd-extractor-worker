import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BiddersManager } from "@/components/bidders/bidders-manager";
import { BidderWorkSection } from "@/components/bidders/bidder-work-section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, LineChart, History, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const sectionNav = [
  { id: "bidders", label: "Bidders", icon: Users },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "performance", label: "Performance", icon: LineChart },
  { id: "transactions", label: "Transaction history", icon: History },
] as const;

const sampleTransactions = [
  { date: "2026-03-28", type: "Placement fee", bidder: "Acme Staffing", amount: "$4,200", status: "Paid" },
  { date: "2026-03-26", type: "Retainer", bidder: "Northwind Talent", amount: "$1,500", status: "Pending" },
  { date: "2026-03-22", type: "Placement fee", bidder: "Contoso Recruiting", amount: "$3,800", status: "Paid" },
] as const;

function SectionNav() {
  return (
    <nav
      aria-label="Bidder management sections"
      className="flex flex-wrap gap-2 rounded-xl border border-border/80 bg-muted/30 p-1.5"
    >
      {sectionNav.map(({ id, label, icon: Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
            "hover:bg-background hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          {label}
        </a>
      ))}
    </nav>
  );
}

export default function BiddersPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Bidder management"
        description={
          <>
            Maintain bidder records and per-bidder work logs in PostgreSQL. Performance and transactions
            remain illustrative until those data sources are wired.
          </>
        }
      />

      <SectionNav />

      <section id="bidders" className="scroll-mt-28 space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
                <Users className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-lg">Bidders</CardTitle>
                <CardDescription>Directory, status, and contact details for staffing partners.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <BiddersManager />
          </CardContent>
        </Card>
      </section>

      <section id="work" className="scroll-mt-28 space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
                <Briefcase className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-lg">Work</CardTitle>
                <CardDescription>
                  Per day: bid count and newly scheduled interview count. Weekly view (Mon–Sun, UTC) shows
                  totals and interview rate (interviews ÷ bids × 100%; — if bids are 0).
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <BidderWorkSection />
          </CardContent>
        </Card>
      </section>

      <section id="performance" className="scroll-mt-28 space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
                <LineChart className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-lg">Performance</CardTitle>
                <CardDescription>Quality and throughput metrics per bidder over a selected period.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Fill rate", value: "—", hint: "Offers accepted ÷ submissions" },
                { label: "Time to submit", value: "—", hint: "Median hours after JD open" },
                { label: "Interview → hire", value: "—", hint: "Conversion in last 90d" },
                { label: "Active reqs", value: "—", hint: "Open roles with this bidder" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{m.label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{m.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{m.hint}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
              Chart and trend views will render here when performance data is available.
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="transactions" className="scroll-mt-28 space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
                <History className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-lg">Transaction history</CardTitle>
                <CardDescription>Fees, retainers, and adjustments tied to bidder activity.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sample layout only. Export and date-range filters can be added alongside real ledger data.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Bidder</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleTransactions.map((row) => (
                  <TableRow key={`${row.date}-${row.type}-${row.bidder}`}>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{row.date}</TableCell>
                    <TableCell className="font-medium">{row.type}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{row.bidder}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{row.amount}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={row.status === "Paid" ? "outline" : "secondary"}>{row.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-center text-xs text-muted-foreground">
              Need another view?{" "}
              <Link href="/dashboard" className="font-medium text-primary underline-offset-4 hover:underline">
                Back to dashboard
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
