import { Skeleton } from "@/components/ui/skeleton";

export default function JobsLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-border/70 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
        <Skeleton className="h-9 w-[5.5rem] shrink-0 rounded-md" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
