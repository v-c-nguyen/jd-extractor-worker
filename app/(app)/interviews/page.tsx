import { PageHeader } from "@/components/page-header";
import { InterviewsManager } from "@/components/interviews/interviews-manager";

export default function InterviewsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Interviews"
        description="Add, edit, browse, and remove interview detail rows per profile. How many you may add is capped by the sum of interview counts in the daily work log for that profile."
      />

      <InterviewsManager />
    </div>
  );
}
