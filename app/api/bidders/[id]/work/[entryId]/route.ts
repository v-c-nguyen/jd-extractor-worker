import { NextResponse } from "next/server";
import { z } from "zod";
import { getBidderById } from "@/lib/bidders/repo";
import { patchBidderWorkSchema } from "@/lib/bidders/work-schema";
import { deleteBidderWork, updateBidderWork } from "@/lib/bidders/work-repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const uuidParam = z.string().uuid();

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === "23505" || (typeof e.message === "string" && e.message.includes("uq_bidder_work_day"));
}

const WORK_SCHEMA_HINT =
  "Run db/migrations/002_bidder_work.sql and db/migrations/003_bidder_work_counts.sql on your database.";

function isWorkSchemaError(msg: string): boolean {
  if (msg.includes("bidder_work_entries") && msg.includes("does not exist")) return true;
  if (msg.includes("relation") && msg.includes("bidder_work_entries") && msg.includes("does not exist")) return true;
  if (msg.includes("bid_count") && msg.includes("does not exist")) return true;
  if (msg.includes("interview_count") && msg.includes("does not exist")) return true;
  return false;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id, entryId } = await params;
    const idOk = uuidParam.safeParse(id);
    const eOk = uuidParam.safeParse(entryId);
    if (!idOk.success || !eOk.success) {
      return jsonError("Invalid id", 400);
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
    const parsed = patchBidderWorkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const entry = await updateBidderWork(idOk.data, eOk.data, parsed.data);
      if (!entry) {
        return jsonError("Work entry not found", 404);
      }
      return NextResponse.json(entry);
    } catch (e) {
      if (isUniqueViolation(e)) {
        return jsonError("Another entry already exists for that date.", 409);
      }
      throw e;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update work entry";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isWorkSchemaError(msg)) {
      return jsonError(`Work log is not fully migrated. ${WORK_SCHEMA_HINT}`, 503);
    }
    console.error("[api/bidders/[id]/work/[entryId] PATCH]", err);
    return jsonError(msg, 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id, entryId } = await params;
    const idOk = uuidParam.safeParse(id);
    const eOk = uuidParam.safeParse(entryId);
    if (!idOk.success || !eOk.success) {
      return jsonError("Invalid id", 400);
    }
    const bidder = await getBidderById(idOk.data);
    if (!bidder) {
      return jsonError("Bidder not found", 404);
    }

    const removed = await deleteBidderWork(idOk.data, eOk.data);
    if (!removed) {
      return jsonError("Work entry not found", 404);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete work entry";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isWorkSchemaError(msg)) {
      return jsonError(`Work log is not fully migrated. ${WORK_SCHEMA_HINT}`, 503);
    }
    console.error("[api/bidders/[id]/work/[entryId] DELETE]", err);
    return jsonError(msg, 500);
  }
}
