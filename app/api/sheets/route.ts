import { NextResponse } from "next/server";
import { listConfiguredSheets } from "@/lib/sheets-api";

export async function GET() {
  try {
    const sheets = await listConfiguredSheets();
    return NextResponse.json({ sheets });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list sheets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
