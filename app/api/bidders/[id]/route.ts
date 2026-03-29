import { NextResponse } from "next/server";
import { z } from "zod";
import { patchBidderSchema } from "@/lib/bidders/schema";
import { deleteBidder, getBidderById, updateBidder } from "@/lib/bidders/repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const uuidParam = z.string().uuid();

export async function GET(
  _request: Request,
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
    return NextResponse.json(bidder);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load bidder";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/bidders/[id] GET]", err);
    return jsonError(msg, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idOk = uuidParam.safeParse(id);
    if (!idOk.success) {
      return jsonError("Invalid bidder id", 400);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const parsed = patchBidderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    try {
      const bidder = await updateBidder(idOk.data, parsed.data);
      if (!bidder) {
        return jsonError("Bidder not found", 404);
      }
      return NextResponse.json(bidder);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      const code = (e as { code?: string }).code;
      if (
        code === "23505" ||
        (m.includes("duplicate key") && m.includes("app_user"))
      ) {
        return jsonError("That app user is already linked to another bidder.", 409);
      }
      throw e;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update bidder";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (msg.includes("app_user_id") && msg.includes("does not exist")) {
      return jsonError(
        "Database is missing bidders.app_user_id. Run db/migrations/008_bidder_work_per_profile.sql.",
        503
      );
    }
    console.error("[api/bidders/[id] PATCH]", err);
    return jsonError(msg, 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idOk = uuidParam.safeParse(id);
    if (!idOk.success) {
      return jsonError("Invalid bidder id", 400);
    }
    const removed = await deleteBidder(idOk.data);
    if (!removed) {
      return jsonError("Bidder not found", 404);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete bidder";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/bidders/[id] DELETE]", err);
    return jsonError(msg, 500);
  }
}
