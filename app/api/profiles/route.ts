import { NextResponse } from "next/server";
import { createProfileSchema } from "@/lib/profiles/schema";
import { createProfile, listProfiles } from "@/lib/profiles/repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const profiles = await listProfiles(q);
    return NextResponse.json({ profiles });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list profiles";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/profiles GET]", err);
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
    const parsed = createProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const profile = await createProfile(parsed.data);
    return NextResponse.json(profile, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create profile";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/profiles POST]", err);
    return jsonError(msg, 500);
  }
}
