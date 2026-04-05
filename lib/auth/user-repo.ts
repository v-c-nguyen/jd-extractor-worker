import { normalizeAppRole, type AppRole } from "@/lib/auth/app-role";
import { getSql } from "@/lib/db/neon-sql";

export type AppUserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: string;
  updated_at: string;
};

/** Inserts a login row for dashboard auth. Email should be normalized (e.g. lowercased). */
export async function insertAppUser(params: {
  email: string;
  passwordHash: string;
  name: string | null;
}): Promise<string> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO app_users (email, password_hash, name)
    VALUES (${params.email}, ${params.passwordHash}, ${params.name})
    RETURNING id
  `) as { id: string }[];
  const id = rows[0]?.id;
  if (!id) throw new Error("Insert returned no app user id");
  return id;
}

/** Role from the bidder row linked to this app user (dashboard authorization). */
export async function getAppUserRole(userId: string): Promise<AppRole> {
  const sql = getSql();
  const rows = (await sql`
    SELECT b.role
    FROM bidders b
    WHERE b.app_user_id = ${userId}::uuid
    LIMIT 1
  `) as { role: string }[];
  return normalizeAppRole(rows[0]?.role);
}

export async function findUserWithPasswordHashByEmail(
  emailLower: string
): Promise<AppUserRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash, name, created_at, updated_at
    FROM app_users
    WHERE lower(email) = ${emailLower}
    LIMIT 1
  `) as AppUserRow[];
  return rows[0] ?? null;
}

/** Bidder row whose login is this app user (bidders.app_user_id = user id), if any. */
export async function getUserProfileById(userId: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  bidderId: string | null;
} | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      u.id,
      u.email,
      u.name,
      u.created_at AS created_at,
      b.id AS bidder_id
    FROM app_users u
    LEFT JOIN bidders b ON b.app_user_id = u.id
    WHERE u.id = ${userId}::uuid
    LIMIT 1
  `) as {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
    bidder_id: string | null;
  }[];
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    createdAt: r.created_at,
    bidderId: r.bidder_id,
  };
}

export async function updateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE app_users
    SET password_hash = ${passwordHash}, updated_at = now()
    WHERE id = ${userId}::uuid
  `;
}
