import { NextResponse } from "next/server";
import { z } from "zod";
import { patchProfileSchema } from "@/lib/profiles/schema";
import { deleteProfile, getProfileById, updateProfile } from "@/lib/profiles/repo";

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
      return jsonError("Invalid profile id", 400);
    }
    const profile = await getProfileById(idOk.data);
    if (!profile) {
      return jsonError("Profile not found", 404);
    }
    return NextResponse.json(profile);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load profile";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/profiles/[id] GET]", err);
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
      return jsonError("Invalid profile id", 400);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const parsed = patchProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const profile = await updateProfile(idOk.data, parsed.data);
    if (!profile) {
      return jsonError("Profile not found", 404);
    }
    return NextResponse.json(profile);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update profile";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/profiles/[id] PATCH]", err);
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
      return jsonError("Invalid profile id", 400);
    }
    const removed = await deleteProfile(idOk.data);
    if (!removed) {
      return jsonError("Profile not found", 404);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete profile";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/profiles/[id] DELETE]", err);
    return jsonError(msg, 500);
  }
}
