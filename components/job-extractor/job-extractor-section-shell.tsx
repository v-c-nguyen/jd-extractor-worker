"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { PipelineStatusProvider } from "@/components/job-extractor/pipeline-status-context";
import { PipelineStatusPill } from "@/components/job-extractor/pipeline-status-pill";
import { JobExtractorSubNav } from "@/components/job-extractor/job-extractor-sub-nav";

export function JobExtractorSectionShell({ children }: { children: ReactNode }) {
  return (
    <PipelineStatusProvider>
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader
          eyebrow="Operations"
          title="Job extractor"
          description="Pipeline control and streaming output are split into separate pages so each task stays focused."
          className="border-border/60 pb-6 md:pb-7"
        >
          <PipelineStatusPill />
        </PageHeader>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <aside className="shrink-0 lg:w-56">
            <JobExtractorSubNav />
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </PipelineStatusProvider>
  );
}
