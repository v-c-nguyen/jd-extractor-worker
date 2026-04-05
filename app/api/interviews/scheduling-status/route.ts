import { NextResponse } from "next/server";
import { listProfileInterviewCapacities, listStaleBookedInterviewSummaries } from "@/lib/interviews/repo";
import { listOpenInterviewSlots } from "@/lib/interviews/scheduling-slots";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const [profileCapacities, openSlots, staleBookedInterviews] = await Promise.all([
      listProfileInterviewCapacities(),
      listOpenInterviewSlots(),
      listStaleBookedInterviewSummaries(),
    ]);
    const canCreateInterview = openSlots.length > 0;
    return NextResponse.json({
      openSlots,
      staleBookedInterviews,
      canCreateInterview,
      profileCapacities,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load scheduling status";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
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
    console.error("[api/interviews/scheduling-status GET]", err);
    return jsonError(msg, 500);
  }
}
