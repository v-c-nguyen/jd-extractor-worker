import { NextResponse } from "next/server";
import { createBidderSchema } from "@/lib/bidders/schema";
import { createBidder, listBidders } from "@/lib/bidders/repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const bidders = await listBidders(q);
    return NextResponse.json({ bidders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list bidders";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/bidders GET]", err);
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
    const parsed = createBidderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const bidder = await createBidder(parsed.data);
    return NextResponse.json(bidder, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create bidder";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/bidders POST]", err);
    return jsonError(msg, 500);
  }
}
