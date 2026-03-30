import { PageHeader } from "@/components/page-header";
import { InterviewsManager } from "@/components/interviews/interviews-manager";

export default function InterviewsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Interview management"
        description="Add, edit, browse, and remove interview records. Each row links to a registered profile."
      />

      <InterviewsManager />
    </div>
  );
}
