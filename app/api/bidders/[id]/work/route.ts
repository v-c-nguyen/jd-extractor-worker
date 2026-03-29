import { NextResponse } from "next/server";
import { z } from "zod";
import { getBidderById } from "@/lib/bidders/repo";
import { createBidderWorkSchema } from "@/lib/bidders/work-schema";
import { validateProfilesForBidder } from "@/lib/bidders/work-profile-guard";
import {
  createBidderWork,
  deleteBidderWorkForDate,
  listBidderWork,
} from "@/lib/bidders/work-repo";
import { listProfilesForBidder } from "@/lib/profiles/repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const uuidParam = z.string().uuid();
const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 89);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return (
    e.code === "23505" ||
    (typeof e.message === "string" &&
      (e.message.includes("uq_bidder_work_day") || e.message.includes("uq_bidder_work_profile_day")))
  );
}

const WORK_SCHEMA_HINT =
  "Run db/migrations through 008_bidder_work_per_profile.sql (002, 003, 007 profiles, 008).";

function isWorkSchemaError(msg: string): boolean {
  if (msg.includes("bidder_work_entries") && msg.includes("does not exist")) return true;
  if (msg.includes("relation") && msg.includes("bidder_work_entries") && msg.includes("does not exist")) return true;
  if (msg.includes("bid_count") && msg.includes("does not exist")) return true;
  if (msg.includes("interview_count") && msg.includes("does not exist")) return true;
  if (msg.includes("profile_id") && msg.includes("does not exist")) return true;
  if (msg.includes("column") && msg.includes("profile_id")) return true;
  return false;
}

export async function GET(
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

    const url = new URL(request.url);
    const fromQ = url.searchParams.get("from");
    const toQ = url.searchParams.get("to");
    let from: string;
    let to: string;
    if (fromQ && toQ) {
      const f = dateParam.safeParse(fromQ);
      const t = dateParam.safeParse(toQ);
      if (!f.success || !t.success) {
        return jsonError("Invalid from/to (use YYYY-MM-DD)", 400);
      }
      from = f.data;
      to = t.data;
      if (from > to) {
        return jsonError("from must be on or before to", 400);
      }
    } else {
      ({ from, to } = defaultRange());
    }

    const [entries, profiles] = await Promise.all([
      listBidderWork(idOk.data, from, to),
      listProfilesForBidder(idOk.data),
    ]);
    return NextResponse.json({ entries, profiles, from, to });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list work entries";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isWorkSchemaError(msg)) {
      return jsonError(`Work log is not fully migrated. ${WORK_SCHEMA_HINT}`, 503);
    }
    console.error("[api/bidders/[id]/work GET]", err);
    return jsonError(msg, 500);
  }
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
    const parsed = createBidderWorkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const v = await validateProfilesForBidder(idOk.data, [parsed.data.profileId]);
    if (!v.ok) {
      return jsonError(v.message, 400);
    }

    try {
      const entry = await createBidderWork(idOk.data, parsed.data);
      return NextResponse.json(entry, { status: 201 });
    } catch (e) {
      if (isUniqueViolation(e)) {
        return jsonError("An entry for this profile and date already exists. Edit that entry instead.", 409);
      }
      throw e;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create work entry";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isWorkSchemaError(msg)) {
      return jsonError(`Work log is not fully migrated. ${WORK_SCHEMA_HINT}`, 503);
    }
    console.error("[api/bidders/[id]/work POST]", err);
    return jsonError(msg, 500);
  }
}

export async function DELETE(
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

    const url = new URL(request.url);
    const dateQ = url.searchParams.get("date");
    const d = dateQ ? dateParam.safeParse(dateQ) : null;
    if (!d?.success) {
      return jsonError("Query ?date=YYYY-MM-DD is required", 400);
    }

    const removed = await deleteBidderWorkForDate(idOk.data, d.data);
    return NextResponse.json({ removed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete work entries";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isWorkSchemaError(msg)) {
      return jsonError(`Work log is not fully migrated. ${WORK_SCHEMA_HINT}`, 503);
    }
    console.error("[api/bidders/[id]/work DELETE]", err);
    return jsonError(msg, 500);
  }
}
