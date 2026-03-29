import { NextResponse } from "next/server";
import { isPipelineRunning } from "@/lib/pipeline-runtime";

export async function GET() {
  const running = isPipelineRunning();
  return NextResponse.json({
    running,
    message: running ? "Pipeline is running" : "Pipeline is stopped",
  });
}
