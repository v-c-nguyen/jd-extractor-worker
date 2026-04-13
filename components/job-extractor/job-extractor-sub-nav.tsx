"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SlidersHorizontal, Terminal } from "lucide-react";

const links = [
  { href: "/job-extractor/control", label: "Control", icon: SlidersHorizontal },
  { href: "/job-extractor/log", label: "Live log", icon: Terminal },
] as const;

export function JobExtractorSubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/25 p-1 lg:flex-col lg:overflow-visible"
      aria-label="Job extractor sections"
    >
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/70"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 opacity-85" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
