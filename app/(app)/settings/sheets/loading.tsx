import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsSheetsLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-3 border-b border-border/70 pb-8">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
