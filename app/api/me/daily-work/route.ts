import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dailyWorkBodySchema } from "@/lib/auth/me-api-schema";
import { getUserProfileById } from "@/lib/auth/user-repo";
import { validateProfilesForBidder } from "@/lib/bidders/work-profile-guard";
import {
  listBidderWork,
  listRecentWorkDateSummaries,
  upsertBidderWorkDay,
} from "@/lib/bidders/work-repo";
import { listProfilesForBidder } from "@/lib/profiles/repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isWorkSchemaError(msg: string): boolean {
  if (msg.includes("bidder_work_entries") && msg.includes("does not exist")) return true;
  if (msg.includes("profile_id") && msg.includes("does not exist")) return true;
  if (msg.includes("column") && msg.includes("profile_id")) return true;
  return false;
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  let bidderId: string | null;
  try {
    const profile = await getUserProfileById(userId);
    bidderId = profile?.bidderId ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    throw err;
  }

  if (!bidderId) {
    return jsonError("Your account is not linked to a bidder.", 403);
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  try {
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return jsonError("Invalid date (use YYYY-MM-DD)", 400);
      }
      const [profiles, entries] = await Promise.all([
        listProfilesForBidder(bidderId),
        listBidderWork(bidderId, date, date),
      ]);
      return NextResponse.json({ workDate: date, profiles, entries });
    }
    const summaries = await listRecentWorkDateSummaries(bidderId, 30);
    return NextResponse.json({ summaries });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load work";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isWorkSchemaError(msg)) {
      return jsonError(
        "Work log is not fully migrated. Run db/migrations through 008_bidder_work_per_profile.sql.",
        503
      );
    }
    console.error("[api/me/daily-work GET]", err);
    return jsonError(msg, 500);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  let bidderId: string | null;
  try {
    const profile = await getUserProfileById(userId);
    bidderId = profile?.bidderId ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    throw err;
  }

  if (!bidderId) {
    return jsonError("Your account is not linked to a bidder.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = dailyWorkBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const profileIds = parsed.data.rows.map((r) => r.profileId);
  const v = await validateProfilesForBidder(bidderId, profileIds);
  if (!v.ok) {
    return jsonError(v.message, 400);
  }

  try {
    const entries = await upsertBidderWorkDay(bidderId, parsed.data);
    return NextResponse.json({ entries });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save work";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isWorkSchemaError(msg)) {
      return jsonError(
        "Work log is not fully migrated. Run db/migrations through 008_bidder_work_per_profile.sql.",
        503
      );
    }
    console.error("[api/me/daily-work POST]", err);
    return jsonError(msg, 500);
  }
}
