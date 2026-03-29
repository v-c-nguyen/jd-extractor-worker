import { Skeleton } from "@/components/ui/skeleton";

export default function JobDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-3 pt-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
