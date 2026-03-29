import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3 border-b border-border/70 pb-8">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <Skeleton className="h-4 w-24" />
      <div className="grid gap-3">
        <Skeleton className="h-[5.5rem] w-full rounded-xl" />
        <Skeleton className="h-[5.5rem] w-full rounded-xl" />
        <Skeleton className="h-[5.5rem] w-full rounded-xl" />
      </div>
      <Skeleton className="h-4 w-32" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}
