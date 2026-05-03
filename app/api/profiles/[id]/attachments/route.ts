import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PROFILE_ATTACHMENT_ALLOWED_MIMES,
  PROFILE_ATTACHMENT_MAX_BYTES,
  PROFILE_ATTACHMENT_MAX_COUNT,
  countProfileAttachments,
  getProfileById,
  insertProfileAttachment,
} from "@/lib/profiles/repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const uuidParam = z.string().uuid();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: profileId } = await params;
    const idOk = uuidParam.safeParse(profileId);
    if (!idOk.success) {
      return jsonError("Invalid profile id", 400);
    }

    if (!(await getProfileById(idOk.data))) {
      return jsonError("Profile not found", 404);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError("Expected multipart form data", 400);
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError('Missing "file" field', 400);
    }

    const mime = (file.type || "application/octet-stream").toLowerCase();
    if (!PROFILE_ATTACHMENT_ALLOWED_MIMES.has(mime)) {
      return jsonError("Only JPEG, PNG, WebP, or GIF images are allowed", 400);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) {
      return jsonError("Empty file", 400);
    }
    if (buf.length > PROFILE_ATTACHMENT_MAX_BYTES) {
      return jsonError(`Each image must be at most ${PROFILE_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MB`, 400);
    }

    const count = await countProfileAttachments(idOk.data);
    if (count >= PROFILE_ATTACHMENT_MAX_COUNT) {
      return jsonError(`At most ${PROFILE_ATTACHMENT_MAX_COUNT} images per profile`, 400);
    }

    const name = file.name.replace(/[/\\]/g, "_").slice(0, 255) || "upload";

    const inserted = await insertProfileAttachment({
      profileId: idOk.data,
      originalName: name,
      mimeType: mime,
      fileData: buf,
    });

    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/profiles/.../attachments POST]", err);
    return jsonError(msg, 500);
  }
}
