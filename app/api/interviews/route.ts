import { NextResponse } from "next/server";
import { createInterviewSchema } from "@/lib/interviews/schema";
import { validateWorkLogSlotForNewInterview } from "@/lib/interviews/scheduling-slots";
import { createInterview, listInterviews } from "@/lib/interviews/repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const interviews = await listInterviews(q);
    return NextResponse.json({ interviews });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list interviews";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/interviews GET]", err);
    return jsonError(msg, 500);
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const parsed = createInterviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const slotOk = await validateWorkLogSlotForNewInterview(
      parsed.data.profileId,
      parsed.data.workLogSlotIndex
    );
    if (!slotOk.ok) {
      return jsonError(slotOk.message, 400);
    }
    const interview = await createInterview(parsed.data);
    return NextResponse.json(interview, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create interview";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (msg.includes("foreign key") || msg.includes("violates foreign key")) {
      return jsonError("Profile not found or invalid profile id.", 400);
    }
    if (
      msg.includes("bidder_work_entries") &&
      (msg.includes("does not exist") || msg.includes("relation"))
    ) {
      return jsonError(
        "Work log table missing. Run db/migrations through 008_bidder_work_per_profile.sql.",
        503
      );
    }
    console.error("[api/interviews POST]", err);
    return jsonError(msg, 500);
  }
}
