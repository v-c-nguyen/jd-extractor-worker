import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dailyReportBodySchema } from "@/lib/auth/me-api-schema";
import {
  getDailyReportForDate,
  listRecentDailyReports,
  upsertDailyReport,
} from "@/lib/auth/user-repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  try {
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return jsonError("Invalid date (use YYYY-MM-DD)", 400);
      }
      const report = await getDailyReportForDate(userId, date);
      return NextResponse.json({ report });
    }
    const reports = await listRecentDailyReports(userId, 30);
    return NextResponse.json({ reports });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load reports";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/me/daily-report GET]", err);
    return jsonError(msg, 500);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = dailyReportBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const report = await upsertDailyReport(userId, parsed.data.reportDate, parsed.data.body);
    return NextResponse.json({ report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save report";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/me/daily-report POST]", err);
    return jsonError(msg, 500);
  }
}
