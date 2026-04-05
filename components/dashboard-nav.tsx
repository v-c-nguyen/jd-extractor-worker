"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  INTERVIEW_ALERT_COUNTS_EVENT,
  type InterviewAlertCountsDetail,
} from "@/lib/interview-scheduling-events";
import { isPathForbiddenForRole } from "@/lib/auth/access-control";
import { normalizeAppRole } from "@/lib/auth/app-role";
import {
  LayoutDashboard,
  SlidersHorizontal,
  Users,
  ContactRound,
  CalendarClock,
  CircleUserRound,
} from "lucide-react";
import { SignOutButton } from "@/components/account/sign-out-button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/job-extractor", label: "Job extractor", icon: SlidersHorizontal },
  { href: "/bidders", label: "Bidders", icon: Users },
  { href: "/profiles", label: "Profiles", icon: ContactRound },
  { href: "/interviews", label: "Interviews", icon: CalendarClock },
  { href: "/me", label: "My account", icon: CircleUserRound },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [interviewAlertTotal, setInterviewAlertTotal] = useState(0);
  const role =
    status === "authenticated" ? normalizeAppRole(session?.user?.role) : null;
  const navItemsVisible = navItems.filter(
    (item) => role === null || !isPathForbiddenForRole(role, item.href)
  );

  useEffect(() => {
    const onCounts = (e: Event) => {
      const d = (e as CustomEvent<InterviewAlertCountsDetail>).detail;
      if (!d) return;
      setInterviewAlertTotal(Math.max(0, d.staleBooked + d.openSlots));
    };
    window.addEventListener(INTERVIEW_ALERT_COUNTS_EVENT, onCounts);
    return () => window.removeEventListener(INTERVIEW_ALERT_COUNTS_EVENT, onCounts);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-card/80 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 md:px-8">
        <Link
          href="/dashboard"
          className="group flex items-center gap-2.5 rounded-lg outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm ring-1 ring-primary/20">
            JD
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-foreground sm:inline">
            Extractor
          </span>
        </Link>
        <nav
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm font-medium md:gap-1"
          aria-label="Main"
        >
          {navItemsVisible.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const isInterviews = item.href === "/interviews";
            const badge =
              isInterviews && interviewAlertTotal > 0 ? (
                <span
                  className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white shadow-sm dark:bg-rose-500"
                  aria-hidden
                >
                  {interviewAlertTotal > 99 ? "99+" : interviewAlertTotal}
                </span>
              ) : null;
            const alertLabel =
              isInterviews && interviewAlertTotal > 0
                ? `${item.label} — ${interviewAlertTotal} open item${interviewAlertTotal === 1 ? "" : "s"} (work log or past Booked)`
                : item.label;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={alertLabel}
                title={alertLabel}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 transition-colors sm:px-3",
                  isActive
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                <span className={cn("relative inline-flex shrink-0", isInterviews && "mt-0.5")}>
                  <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  {badge}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <SignOutButton />
      </div>
    </header>
  );
}
