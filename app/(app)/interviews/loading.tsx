import { Skeleton } from "@/components/ui/skeleton";

export default function InterviewsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3 border-b border-border/70 pb-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
