import { NextResponse } from "next/server";
import { z } from "zod";
import { getBidderById } from "@/lib/bidders/repo";
import { bidderWorkDayBatchSchema } from "@/lib/bidders/work-schema";
import { validateProfilesForBidder } from "@/lib/bidders/work-profile-guard";
import { upsertBidderWorkDay } from "@/lib/bidders/work-repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const uuidParam = z.string().uuid();

const WORK_SCHEMA_HINT =
  "Run db/migrations through 008_bidder_work_per_profile.sql (002, 003, 007 profiles, 008).";

function isWorkSchemaError(msg: string): boolean {
  if (msg.includes("bidder_work_entries") && msg.includes("does not exist")) return true;
  if (msg.includes("relation") && msg.includes("bidder_work_entries") && msg.includes("does not exist")) return true;
  if (msg.includes("profile_id") && msg.includes("does not exist")) return true;
  if (msg.includes("column") && msg.includes("profile_id")) return true;
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idOk = uuidParam.safeParse(id);
    if (!idOk.success) {
      return jsonError("Invalid bidder id", 400);
    }
    const bidder = await getBidderById(idOk.data);
    if (!bidder) {
      return jsonError("Bidder not found", 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const parsed = bidderWorkDayBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const profileIds = parsed.data.rows.map((r) => r.profileId);
    const v = await validateProfilesForBidder(idOk.data, profileIds);
    if (!v.ok) {
      return jsonError(v.message, 400);
    }

    const entries = await upsertBidderWorkDay(idOk.data, parsed.data);
    return NextResponse.json({ entries });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save work entries";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isWorkSchemaError(msg)) {
      return jsonError(`Work log is not fully migrated. ${WORK_SCHEMA_HINT}`, 503);
    }
    console.error("[api/bidders/[id]/work/batch POST]", err);
    return jsonError(msg, 500);
  }
}
