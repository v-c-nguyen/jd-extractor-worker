import { DashboardNav } from "@/components/dashboard-nav";
import { InterviewAppBanners } from "@/components/interview-app-banners";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-surface flex min-h-screen flex-col">
      <DashboardNav />
      <InterviewAppBanners />
      <main className="flex-1 border-t border-border/50 bg-muted/20">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10 lg:py-12">{children}</div>
      </main>
    </div>
  );
}
