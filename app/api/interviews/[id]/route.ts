import { NextResponse } from "next/server";
import { z } from "zod";
import { patchInterviewSchema } from "@/lib/interviews/schema";
import { validateInterviewProfileReassignment } from "@/lib/interviews/profile-interview-capacity";
import { deleteInterview, getInterviewById, updateInterview } from "@/lib/interviews/repo";

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
      return jsonError("Invalid interview id", 400);
    }
    const interview = await getInterviewById(idOk.data);
    if (!interview) {
      return jsonError("Interview not found", 404);
    }
    return NextResponse.json(interview);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load interview";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/interviews/[id] GET]", err);
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
      return jsonError("Invalid interview id", 400);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const parsed = patchInterviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const existing = await getInterviewById(idOk.data);
    if (!existing) {
      return jsonError("Interview not found", 404);
    }
    if (parsed.data.profileId !== undefined && parsed.data.profileId !== existing.profileId) {
      const cap = await validateInterviewProfileReassignment(existing.profileId, parsed.data.profileId);
      if (!cap.ok) {
        return jsonError(cap.message, 400);
      }
    }
    const interview = await updateInterview(idOk.data, parsed.data);
    if (!interview) {
      return jsonError("Interview not found", 404);
    }
    return NextResponse.json(interview);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update interview";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (msg.includes("foreign key") || msg.includes("violates foreign key")) {
      return jsonError("Profile not found or invalid profile id.", 400);
    }
    console.error("[api/interviews/[id] PATCH]", err);
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
      return jsonError("Invalid interview id", 400);
    }
    const removed = await deleteInterview(idOk.data);
    if (!removed) {
      return jsonError("Interview not found", 404);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete interview";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/interviews/[id] DELETE]", err);
    return jsonError(msg, 500);
  }
}
