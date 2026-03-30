import { DashboardNav } from "@/components/dashboard-nav";
import { InterviewSchedulingBanner } from "@/components/interview-scheduling-banner";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-surface flex min-h-screen flex-col">
      <DashboardNav />
      <InterviewSchedulingBanner />
      <main className="flex-1 px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
