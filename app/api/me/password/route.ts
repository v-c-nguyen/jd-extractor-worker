import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { changePasswordBodySchema } from "@/lib/auth/me-api-schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { findUserWithPasswordHashByEmail, updateUserPasswordHash } from "@/lib/auth/user-repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId || !email) {
    return jsonError("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = changePasswordBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const row = await findUserWithPasswordHashByEmail(email.trim().toLowerCase());
    if (!row || row.id !== userId) {
      return jsonError("Unauthorized", 401);
    }
    const ok = await verifyPassword(parsed.data.currentPassword, row.password_hash);
    if (!ok) {
      return jsonError("Current password is incorrect", 400);
    }
    const nextHash = await hashPassword(parsed.data.newPassword);
    await updateUserPasswordHash(userId, nextHash);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update password";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    console.error("[api/me/password PATCH]", err);
    return jsonError(msg, 500);
  }
}
