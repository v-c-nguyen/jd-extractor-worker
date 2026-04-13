import { Skeleton } from "@/components/ui/skeleton";

export default function JobExtractorLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-3 border-b border-border/60 pb-6 md:pb-7">
        <Skeleton className="h-3 w-24" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48 sm:h-10 sm:w-52" />
            <Skeleton className="h-4 w-full max-w-lg" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-8 w-[7.5rem] rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="shrink-0 space-y-2 lg:w-56">
          <Skeleton className="h-11 w-full rounded-xl lg:h-10" />
          <Skeleton className="h-11 w-full rounded-xl lg:h-10" />
        </div>
        <Skeleton className="min-h-64 flex-1 rounded-xl" />
      </div>
    </div>
  );
}
