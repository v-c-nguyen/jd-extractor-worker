import { NextResponse } from "next/server";
import { getJobById } from "@/lib/sheets-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await getJobById(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
