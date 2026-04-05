import Link from "next/link";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isPathForbiddenForRole } from "@/lib/auth/access-control";
import { normalizeAppRole } from "@/lib/auth/app-role";
import {
  SlidersHorizontal,
  Users,
  ContactRound,
  CalendarClock,
  Briefcase,
  FileSpreadsheet,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryLinks = [
  {
    href: "/job-extractor",
    title: "Job extractor",
    description: "Start, stop, and monitor the extraction pipeline and logs.",
    icon: SlidersHorizontal,
  },
  {
    href: "/bidders",
    title: "Bidders",
    description: "Bidder directory, performance metrics, and transaction history.",
    icon: Users,
  },
  {
    href: "/profiles",
    title: "Profiles",
    description: "People profiles with emails, links, and optional link to a registered bidder.",
    icon: ContactRound,
  },
  {
    href: "/interviews",
    title: "Interviews",
    description: "Interview management (coming soon).",
    icon: CalendarClock,
  },
] as const;

const utilityLinks = [
  { href: "/jobs", title: "Jobs", description: "Browse extracted job postings.", icon: Briefcase },
  {
    href: "/settings/sheets",
    title: "Sheets",
    description: "Spreadsheet settings.",
    icon: FileSpreadsheet,
  },
] as const;

export default async function DashboardPage() {
  const session = await auth();
  const role = normalizeAppRole(session?.user?.role);
  const primaryLinksVisible = primaryLinks.filter((item) => !isPathForbiddenForRole(role, item.href));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Home"
        title="Dashboard"
        description="Use the top navigation to open each area, or jump in from the shortcuts below."
      />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Sections</h2>
        <ul className="grid gap-3">
          {primaryLinksVisible.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-colors",
                    "hover:border-border hover:bg-accent/30"
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Data & settings</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {utilityLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.href} className="shadow-sm transition-colors hover:bg-accent/20">
                <CardHeader className="pb-3">
                  <Link href={item.href} className="block rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                      {item.title}
                    </CardTitle>
                    <CardDescription className="mt-1.5">{item.description}</CardDescription>
                  </Link>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
