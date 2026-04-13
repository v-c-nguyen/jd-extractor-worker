import { NextResponse } from "next/server";
import { clearJdExtractorLocalState } from "@/lib/jd-extractor-local-reset";
import { isPipelineRunning, pushSystemLog } from "@/lib/pipeline-runtime";

export async function POST() {
  if (isPipelineRunning()) {
    return NextResponse.json(
      {
        success: false,
        message: "Stop the pipeline before clearing local caches and hashes.",
      },
      { status: 409 }
    );
  }
  try {
    const { removedCacheFiles } = clearJdExtractorLocalState();
    pushSystemLog(
      `Local JD state cleared (${removedCacheFiles} cache file(s) removed, hashes reset)`
    );
    return NextResponse.json({
      success: true,
      removedCacheFiles,
      message: "Cleared cache text files and deduplication hashes.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
