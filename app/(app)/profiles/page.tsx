import { PageHeader } from "@/components/page-header";
import { ProfilesManager } from "@/components/profiles/profiles-manager";

export default function ProfilesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Profiles"
        description="Add, edit, and browse profiles. Link each profile to a registered bidder when applicable."
      />
      <ProfilesManager />
    </div>
  );
}
