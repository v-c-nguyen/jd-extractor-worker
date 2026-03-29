import { getSql } from "@/lib/db/neon-sql";
import type { BidderWorkEntry } from "@/lib/bidders/types";
import type { CreateBidderWorkInput, PatchBidderWorkInput } from "@/lib/bidders/work-schema";

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
    workDate: dateOnly(row.work_date),
    bidCount: mapCount(row.bid_count),
    interviewCount: mapCount(row.interview_count),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listBidderWork(
  bidderId: string,
  fromDate: string,
  toDate: string
): Promise<BidderWorkEntry[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, bidder_id, work_date, bid_count, interview_count, created_at, updated_at
    FROM bidder_work_entries
    WHERE bidder_id = ${bidderId}::uuid
      AND work_date >= ${fromDate}::date
      AND work_date <= ${toDate}::date
    ORDER BY work_date DESC, id DESC
  `) as WorkRow[];
  return rows.map(mapWorkRow);
}

export async function getBidderWorkById(
  bidderId: string,
  entryId: string
): Promise<BidderWorkEntry | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, bidder_id, work_date, bid_count, interview_count, created_at, updated_at
    FROM bidder_work_entries
    WHERE id = ${entryId}::uuid AND bidder_id = ${bidderId}::uuid
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
    INSERT INTO bidder_work_entries (bidder_id, work_date, bid_count, interview_count)
    VALUES (${bidderId}::uuid, ${input.workDate}::date, ${input.bidCount}, ${input.interviewCount})
    RETURNING id, bidder_id, work_date, bid_count, interview_count, created_at, updated_at
  `) as WorkRow[];
  const row0 = inserted[0];
  if (!row0) throw new Error("Insert returned no row");
  return mapWorkRow(row0);
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
    RETURNING id, bidder_id, work_date, bid_count, interview_count, created_at, updated_at
  `) as WorkRow[];
  const row0 = rows[0];
  return row0 ? mapWorkRow(row0) : null;
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
