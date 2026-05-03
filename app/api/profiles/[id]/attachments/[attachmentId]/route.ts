import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteProfileAttachment, getProfileAttachmentFile } from "@/lib/profiles/repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const uuidParam = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: profileId, attachmentId } = await params;
    const pid = uuidParam.safeParse(profileId);
    const aid = uuidParam.safeParse(attachmentId);
    if (!pid.success || !aid.success) {
      return jsonError("Invalid id", 400);
    }

    const row = await getProfileAttachmentFile(pid.data, aid.data);
    if (!row) {
      return jsonError("Not found", 404);
    }

    return new NextResponse(new Uint8Array(row.fileData), {
      status: 200,
      headers: {
        "Content-Type": row.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(row.originalName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load file";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/profiles/.../attachments/... GET]", err);
    return jsonError(msg, 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: profileId, attachmentId } = await params;
    const pid = uuidParam.safeParse(profileId);
    const aid = uuidParam.safeParse(attachmentId);
    if (!pid.success || !aid.success) {
      return jsonError("Invalid id", 400);
    }

    const removed = await deleteProfileAttachment(pid.data, aid.data);
    if (!removed) {
      return jsonError("Not found", 404);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/profiles/.../attachments/... DELETE]", err);
    return jsonError(msg, 500);
  }
}
