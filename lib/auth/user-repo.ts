import { getSql } from "@/lib/db/neon-sql";

export type AppUserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: string;
  updated_at: string;
};

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

export async function getUserProfileById(userId: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
} | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, name, created_at AS created_at
    FROM app_users
    WHERE id = ${userId}::uuid
    LIMIT 1
  `) as { id: string; email: string; name: string | null; created_at: string }[];
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, email: r.email, name: r.name, createdAt: r.created_at };
}

export async function updateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE app_users
    SET password_hash = ${passwordHash}, updated_at = now()
    WHERE id = ${userId}::uuid
  `;
}

export type DailyReportRow = {
  id: string;
  report_date: string;
  body: string;
  updated_at: string;
};

export async function getDailyReportForDate(
  userId: string,
  reportDate: string
): Promise<DailyReportRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, report_date::text AS report_date, body, updated_at
    FROM user_daily_reports
    WHERE user_id = ${userId}::uuid AND report_date = ${reportDate}::date
    LIMIT 1
  `) as DailyReportRow[];
  return rows[0] ?? null;
}

export async function listRecentDailyReports(
  userId: string,
  limit: number
): Promise<DailyReportRow[]> {
  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 1), 60);
  return (await sql`
    SELECT id, report_date::text AS report_date, body, updated_at
    FROM user_daily_reports
    WHERE user_id = ${userId}::uuid
    ORDER BY report_date DESC
    LIMIT ${safeLimit}
  `) as DailyReportRow[];
}

export async function upsertDailyReport(
  userId: string,
  reportDate: string,
  body: string
): Promise<DailyReportRow> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO user_daily_reports (user_id, report_date, body)
    VALUES (${userId}::uuid, ${reportDate}::date, ${body})
    ON CONFLICT (user_id, report_date)
    DO UPDATE SET body = EXCLUDED.body, updated_at = now()
    RETURNING id, report_date::text AS report_date, body, updated_at
  `) as DailyReportRow[];
  const r = rows[0];
  if (!r) {
    throw new Error("Failed to save daily report");
  }
  return r;
}
