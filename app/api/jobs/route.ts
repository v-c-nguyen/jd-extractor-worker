import { NextResponse } from "next/server";
import { listJobs } from "@/lib/sheets-api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetIndex = parseInt(searchParams.get("sheetIndex") ?? "0", 10);
    const { jobs, spreadsheetId, sheetName } = await listJobs(sheetIndex);
    return NextResponse.json({
      jobs,
      sheet: { spreadsheetId, sheetName },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
