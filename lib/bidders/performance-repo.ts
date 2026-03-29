import { getSql } from "@/lib/db/neon-sql";
import type { BidderPerformanceRow, PeriodPerformance, WeeklyTeamRatePoint } from "@/lib/bidders/performance-types";

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysUtc(iso: string, delta: number): string {
  const d = new Date(iso + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Monday (UTC) of the calendar week containing `iso` (YYYY-MM-DD). */
function mondayOfWeekContainingIso(iso: string): string {
  const d = new Date(iso + "T12:00:00.000Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function firstDayOfMonthUtc(iso: string): string {
  const d = new Date(iso + "T12:00:00.000Z");
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function lastDayOfMonthUtc(iso: string): string {
  const d = new Date(iso + "T12:00:00.000Z");
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
}

function interviewRatePct(bids: number, interviews: number): number | null {
  if (bids === 0) return null;
  return Math.round((interviews / bids) * 1000) / 10;
}

type AggRow = {
  id: string;
  name: string;
  bids_today: unknown;
  int_today: unknown;
  bids_week: unknown;
  int_week: unknown;
  bids_month: unknown;
  int_month: unknown;
};

function mapCount(v: unknown): number {
  if (typeof v === "bigint") return Math.max(0, Number(v));
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.trunc(v));
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

function period(bids: number, interviews: number): PeriodPerformance {
  return {
    bidCount: bids,
    interviewCount: interviews,
    interviewRatePct: interviewRatePct(bids, interviews),
  };
}

function dateOnlyFromRow(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return String(v).slice(0, 10);
}

export async function listBidderPerformanceRows(): Promise<BidderPerformanceRow[]> {
  const sql = getSql();
  const today = todayIsoUtc();
  const weekStart = mondayOfWeekContainingIso(today);
  const weekEnd = addDaysUtc(weekStart, 6);
  const monthStart = firstDayOfMonthUtc(today);
  const monthEnd = lastDayOfMonthUtc(today);

  const rows = (await sql`
    SELECT
      b.id,
      b.name,
      COALESCE(SUM(CASE WHEN w.work_date = ${today}::date THEN w.bid_count ELSE 0 END), 0) AS bids_today,
      COALESCE(SUM(CASE WHEN w.work_date = ${today}::date THEN w.interview_count ELSE 0 END), 0) AS int_today,
      COALESCE(
        SUM(
          CASE
            WHEN w.work_date >= ${weekStart}::date AND w.work_date <= ${weekEnd}::date THEN w.bid_count
            ELSE 0
          END
        ),
        0
      ) AS bids_week,
      COALESCE(
        SUM(
          CASE
            WHEN w.work_date >= ${weekStart}::date AND w.work_date <= ${weekEnd}::date THEN w.interview_count
            ELSE 0
          END
        ),
        0
      ) AS int_week,
      COALESCE(
        SUM(
          CASE
            WHEN w.work_date >= ${monthStart}::date AND w.work_date <= ${monthEnd}::date THEN w.bid_count
            ELSE 0
          END
        ),
        0
      ) AS bids_month,
      COALESCE(
        SUM(
          CASE
            WHEN w.work_date >= ${monthStart}::date AND w.work_date <= ${monthEnd}::date THEN w.interview_count
            ELSE 0
          END
        ),
        0
      ) AS int_month
    FROM bidders b
    LEFT JOIN bidder_work_entries w ON w.bidder_id = b.id
    GROUP BY b.id, b.name
    ORDER BY LOWER(b.name) ASC
  `) as AggRow[];

  return rows.map((r) => {
    const bt = mapCount(r.bids_today);
    const it = mapCount(r.int_today);
    const bw = mapCount(r.bids_week);
    const iw = mapCount(r.int_week);
    const bm = mapCount(r.bids_month);
    const im = mapCount(r.int_month);
    return {
      bidderId: r.id,
      name: r.name,
      today: period(bt, it),
      week: period(bw, iw),
      month: period(bm, im),
    };
  });
}

type WeekAggRow = {
  ord: unknown;
  ws: unknown;
  bids: unknown;
  interviews: unknown;
};

/** Last five Mon–Sun (UTC) weeks: oldest first, current week last. Aggregated across all bidders. */
export async function listRecentWeeklyTeamRates(): Promise<WeeklyTeamRatePoint[]> {
  const sql = getSql();
  const today = todayIsoUtc();
  const currentMonday = mondayOfWeekContainingIso(today);
  const ws0 = addDaysUtc(currentMonday, -28);
  const ws1 = addDaysUtc(currentMonday, -21);
  const ws2 = addDaysUtc(currentMonday, -14);
  const ws3 = addDaysUtc(currentMonday, -7);
  const ws4 = currentMonday;

  const rows = (await sql`
    WITH weeks(ord, ws) AS (
      VALUES
        (0, ${ws0}::date),
        (1, ${ws1}::date),
        (2, ${ws2}::date),
        (3, ${ws3}::date),
        (4, ${ws4}::date)
    )
    SELECT
      weeks.ord,
      weeks.ws,
      COALESCE(SUM(w.bid_count), 0) AS bids,
      COALESCE(SUM(w.interview_count), 0) AS interviews
    FROM weeks
    LEFT JOIN bidder_work_entries w
      ON w.work_date >= weeks.ws
      AND w.work_date < weeks.ws + interval '7 days'
    GROUP BY weeks.ord, weeks.ws
    ORDER BY weeks.ord ASC
  `) as WeekAggRow[];

  return rows.map((r) => {
    const ws = dateOnlyFromRow(r.ws);
    const bids = mapCount(r.bids);
    const interviews = mapCount(r.interviews);
    return {
      weekStart: ws,
      weekEnd: addDaysUtc(ws, 6),
      bidCount: bids,
      interviewCount: interviews,
      interviewRatePct: interviewRatePct(bids, interviews),
    };
  });
}
