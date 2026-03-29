import { getSql } from "@/lib/db/neon-sql";
import type { BidderWorkEntry } from "@/lib/bidders/types";
import type {
  BidderWorkDayBatchInput,
  CreateBidderWorkInput,
  PatchBidderWorkInput,
} from "@/lib/bidders/work-schema";

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date().toISOString();
}

function dateOnly(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v ?? "").slice(0, 10);
}

function mapCount(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.trunc(v));
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

type WorkRow = {
  id: string;
  bidder_id: string;
  profile_id: string;
  profile_name: string;
  work_date: unknown;
  bid_count?: unknown;
  interview_count?: unknown;
  created_at: unknown;
  updated_at: unknown;
};

function mapWorkRow(row: WorkRow): BidderWorkEntry {
  return {
    id: row.id,
    bidderId: row.bidder_id,
    profileId: row.profile_id,
    profileName: row.profile_name,
    workDate: dateOnly(row.work_date),
    bidCount: mapCount(row.bid_count),
    interviewCount: mapCount(row.interview_count),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

const workJoinFrom = `
  bidder_work_entries w
  JOIN profiles p ON p.id = w.profile_id
`;

const workSelectCols = `
  w.id,
  w.bidder_id,
  w.profile_id,
  COALESCE(p.name, '') AS profile_name,
  w.work_date,
  w.bid_count,
  w.interview_count,
  w.created_at,
  w.updated_at
`;

export async function listBidderWork(
  bidderId: string,
  fromDate: string,
  toDate: string
): Promise<BidderWorkEntry[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT ${sql.unsafe(workSelectCols)}
    FROM ${sql.unsafe(workJoinFrom)}
    WHERE w.bidder_id = ${bidderId}::uuid
      AND w.work_date >= ${fromDate}::date
      AND w.work_date <= ${toDate}::date
    ORDER BY w.work_date DESC, lower(p.name) ASC, w.id DESC
  `) as WorkRow[];
  return rows.map(mapWorkRow);
}

export async function getBidderWorkById(
  bidderId: string,
  entryId: string
): Promise<BidderWorkEntry | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT ${sql.unsafe(workSelectCols)}
    FROM ${sql.unsafe(workJoinFrom)}
    WHERE w.id = ${entryId}::uuid AND w.bidder_id = ${bidderId}::uuid
    LIMIT 1
  `) as WorkRow[];
  const row = rows[0];
  return row ? mapWorkRow(row) : null;
}

export async function createBidderWork(
  bidderId: string,
  input: CreateBidderWorkInput
): Promise<BidderWorkEntry> {
  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO bidder_work_entries (bidder_id, profile_id, work_date, bid_count, interview_count)
    VALUES (
      ${bidderId}::uuid,
      ${input.profileId}::uuid,
      ${input.workDate}::date,
      ${input.bidCount},
      ${input.interviewCount}
    )
    RETURNING id
  `) as { id: string }[];
  const id = inserted[0]?.id;
  if (!id) throw new Error("Insert returned no row");
  const full = await getBidderWorkById(bidderId, id);
  if (!full) throw new Error("Failed to load work entry after insert");
  return full;
}

export async function updateBidderWork(
  bidderId: string,
  entryId: string,
  patch: PatchBidderWorkInput
): Promise<BidderWorkEntry | null> {
  const existing = await getBidderWorkById(bidderId, entryId);
  if (!existing) return null;

  const nextDate = patch.workDate !== undefined ? patch.workDate : existing.workDate;
  const nextBids = patch.bidCount !== undefined ? patch.bidCount : existing.bidCount;
  const nextInterviews = patch.interviewCount !== undefined ? patch.interviewCount : existing.interviewCount;

  const sql = getSql();
  const rows = (await sql`
    UPDATE bidder_work_entries
    SET
      work_date = ${nextDate}::date,
      bid_count = ${nextBids},
      interview_count = ${nextInterviews}
    WHERE id = ${entryId}::uuid AND bidder_id = ${bidderId}::uuid
    RETURNING id
  `) as { id: string }[];
  if (rows.length === 0) return null;
  return getBidderWorkById(bidderId, entryId);
}

export async function deleteBidderWork(bidderId: string, entryId: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM bidder_work_entries
    WHERE id = ${entryId}::uuid AND bidder_id = ${bidderId}::uuid
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function deleteBidderWorkForDate(bidderId: string, workDate: string): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM bidder_work_entries
    WHERE bidder_id = ${bidderId}::uuid AND work_date = ${workDate}::date
    RETURNING id
  `) as { id: string }[];
  return rows.length;
}

export async function upsertBidderWorkDay(
  bidderId: string,
  input: BidderWorkDayBatchInput
): Promise<BidderWorkEntry[]> {
  const sql = getSql();
  const out: BidderWorkEntry[] = [];
  for (const r of input.rows) {
    const ret = (await sql`
      INSERT INTO bidder_work_entries (bidder_id, profile_id, work_date, bid_count, interview_count)
      VALUES (
        ${bidderId}::uuid,
        ${r.profileId}::uuid,
        ${input.workDate}::date,
        ${r.bidCount},
        ${r.interviewCount}
      )
      ON CONFLICT (bidder_id, profile_id, work_date)
      DO UPDATE SET
        bid_count = EXCLUDED.bid_count,
        interview_count = EXCLUDED.interview_count
      RETURNING id
    `) as { id: string }[];
    const id = ret[0]?.id;
    if (!id) continue;
    const full = await getBidderWorkById(bidderId, id);
    if (full) out.push(full);
  }
  return out;
}

export type WorkDateSummaryRow = {
  work_date: string;
  bid_count: unknown;
  interview_count: unknown;
};

export async function listRecentWorkDateSummaries(
  bidderId: string,
  limit: number
): Promise<{ workDate: string; bidCount: number; interviewCount: number }[]> {
  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 1), 60);
  const rows = (await sql`
    SELECT
      work_date::text AS work_date,
      COALESCE(SUM(bid_count), 0) AS bid_count,
      COALESCE(SUM(interview_count), 0) AS interview_count
    FROM bidder_work_entries
    WHERE bidder_id = ${bidderId}::uuid
    GROUP BY work_date
    ORDER BY work_date DESC
    LIMIT ${safeLimit}
  `) as WorkDateSummaryRow[];
  return rows.map((r) => ({
    workDate: r.work_date,
    bidCount: mapCount(r.bid_count),
    interviewCount: mapCount(r.interview_count),
  }));
}
