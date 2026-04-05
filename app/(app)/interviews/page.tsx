import { PageHeader } from "@/components/page-header";
import { InterviewsManager } from "@/components/interviews/interviews-manager";

export default function InterviewsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Interviews"
        description="When adding details, pick an open interview from the work log (scheduled date comes from the day those counts were logged). Edit and browse existing rows as usual."
      />

      <InterviewsManager />
    </div>
  );
}
