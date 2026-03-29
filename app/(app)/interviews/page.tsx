import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function InterviewsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Interview management"
        description="Schedule and track interviews. Specific workflows and integrations will land here next."
      />

      <Card>
        <CardHeader>
          <CardTitle>Interviews</CardTitle>
          <CardDescription>
            This area is reserved for interview scheduling, status, and follow-up. No backend wiring yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            When you define requirements (fields, sheets, automations), lists, forms, and API routes can be added
            here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
