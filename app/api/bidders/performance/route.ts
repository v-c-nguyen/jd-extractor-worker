import { NextResponse } from "next/server";
import { listBidderPerformanceRows, listRecentWeeklyTeamRates } from "@/lib/bidders/performance-repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const [bidders, weeklyHistory] = await Promise.all([
      listBidderPerformanceRows(),
      listRecentWeeklyTeamRates(),
    ]);
    return NextResponse.json({ bidders, weeklyHistory });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load performance";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/bidders/performance GET]", err);
    return jsonError(msg, 500);
  }
}
