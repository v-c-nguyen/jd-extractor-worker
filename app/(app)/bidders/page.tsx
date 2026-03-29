import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BiddersManager } from "@/components/bidders/bidders-manager";
import { BidderWorkSection } from "@/components/bidders/bidder-work-section";
import { BidderPerformanceSection } from "@/components/bidders/bidder-performance-section";
import { BidderTransactionSection } from "@/components/bidders/bidder-transaction-section";
import { Users, LineChart, History, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const sectionNav = [
  { id: "bidders", label: "Bidders", icon: Users },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "performance", label: "Performance", icon: LineChart },
  { id: "transactions", label: "Transaction history", icon: History },
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
            Maintain bidder records, per-bidder work logs, performance rollups, and a per-bidder transaction ledger in
            PostgreSQL.
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
                <CardDescription>
                  Per bidder: interview count, bid count, and interview rate (interviews ÷ bids × 100%) for today, this
                  week (Mon–Sun, UTC), and this month (UTC). Below: last five weeks of combined team interview rate.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <BidderPerformanceSection />
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
                <CardDescription>
                  Per bidder: date, type, amount, token standard (BEP20, ERC20, other), status, and on-chain hash.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <BidderTransactionSection />
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
