import { getSql } from "@/lib/db/neon-sql";
import type { Interview } from "@/lib/interviews/types";
import type { CreateInterviewInput, PatchInterviewInput } from "@/lib/interviews/schema";

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date().toISOString();
}

function dateOnly(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    const s = v.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  return null;
}

type InterviewRow = {
  id: string;
  profile_id: string;
  profile_name: string;
  interview_date: unknown;
  applied_date: unknown;
  booked_date: unknown;
  interview_type: string;
  result: string;
  pass_status: string;
  stage: string;
  meeting_where: string;
  practice_field: string;
  company: string;
  resume: string;
  jd: string;
  note: string;
  created_at: unknown;
  updated_at: unknown;
};

function mapRow(row: InterviewRow): Interview {
  const idate = dateOnly(row.interview_date);
  if (!idate) throw new Error("Invalid interview_date");
  return {
    id: row.id,
    profileId: row.profile_id,
    profileName: row.profile_name,
    interviewDate: idate,
    appliedDate: dateOnly(row.applied_date),
    bookedDate: dateOnly(row.booked_date),
    interviewType: row.interview_type,
    result: row.result,
    passStatus: row.pass_status,
    stage: row.stage,
    meetingWhere: row.meeting_where,
    practiceField: row.practice_field,
    company: row.company,
    resume: row.resume,
    jd: row.jd,
    note: row.note,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

const listSelect = `
  SELECT
    i.id,
    i.profile_id,
    p.name AS profile_name,
    i.interview_date,
    i.applied_date,
    i.booked_date,
    i.interview_type,
    i.result,
    i.pass_status,
    i.stage,
    i.meeting_where,
    i.practice_field,
    i.company,
    i.resume,
    i.jd,
    i.note,
    i.created_at,
    i.updated_at
  FROM interviews i
  JOIN profiles p ON p.id = i.profile_id
`;

export async function listInterviews(search?: string): Promise<Interview[]> {
  const sql = getSql();
  const q = search?.trim() ?? "";
  const rows = (await sql`
    ${sql.unsafe(listSelect)}
    WHERE (
      ${q}::text = ''
      OR p.name ILIKE '%' || ${q} || '%'
      OR i.company ILIKE '%' || ${q} || '%'
      OR i.interview_type ILIKE '%' || ${q} || '%'
      OR i.note ILIKE '%' || ${q} || '%'
      OR i.jd ILIKE '%' || ${q} || '%'
    )
    ORDER BY i.interview_date DESC, i.created_at DESC
  `) as InterviewRow[];
  return rows.map((row) => mapRow(row));
}

export async function countInterviewsForProfile(profileId: string): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    SELECT COUNT(*)::int AS c FROM interviews WHERE profile_id = ${profileId}::uuid
  `) as { c: number }[];
  return rows[0]?.c ?? 0;
}

/** Total interview counts logged in bidder_work_entries for this profile (all dates). */
export async function sumWorkInterviewCountForProfile(profileId: string): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    SELECT COALESCE(SUM(interview_count), 0)::int AS s
    FROM bidder_work_entries
    WHERE profile_id = ${profileId}::uuid
  `) as { s: number }[];
  return rows[0]?.s ?? 0;
}

export type ProfileInterviewCapacity = {
  profileId: string;
  profileName: string;
  /** Target = SUM(interview_count) in bidder_work_entries for this profile. */
  scheduledCount: number;
  enteredCount: number;
  remaining: number;
};

/** Per profile: work-log interview total vs interview detail rows. */
export async function listProfileInterviewCapacities(): Promise<ProfileInterviewCapacity[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      p.id AS profile_id,
      p.name AS profile_name,
      COALESCE(ws.total, 0)::int AS scheduled_count,
      COALESCE(ic.cnt, 0)::int AS entered_count
    FROM profiles p
    LEFT JOIN (
      SELECT profile_id, SUM(interview_count)::int AS total
      FROM bidder_work_entries
      GROUP BY profile_id
    ) ws ON ws.profile_id = p.id
    LEFT JOIN (
      SELECT profile_id, COUNT(*)::int AS cnt FROM interviews GROUP BY profile_id
    ) ic ON ic.profile_id = p.id
    ORDER BY lower(p.name) ASC, p.id ASC
  `) as {
    profile_id: string;
    profile_name: string;
    scheduled_count: number;
    entered_count: number;
  }[];
  return rows.map((r) => {
    const scheduled = r.scheduled_count;
    const entered = r.entered_count;
    return {
      profileId: r.profile_id,
      profileName: r.profile_name,
      scheduledCount: scheduled,
      enteredCount: entered,
      remaining: Math.max(0, scheduled - entered),
    };
  });
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const sql = getSql();
  const rows = (await sql`
    ${sql.unsafe(listSelect)}
    WHERE i.id = ${id}::uuid
  `) as InterviewRow[];
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function createInterview(input: CreateInterviewInput): Promise<Interview> {
  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO interviews (
      profile_id,
      interview_date,
      applied_date,
      booked_date,
      interview_type,
      result,
      pass_status,
      stage,
      meeting_where,
      practice_field,
      company,
      resume,
      jd,
      note
    )
    VALUES (
      ${input.profileId}::uuid,
      ${input.interviewDate}::date,
      ${input.appliedDate === undefined ? null : input.appliedDate},
      ${input.bookedDate === undefined ? null : input.bookedDate},
      ${input.interviewType},
      ${input.result},
      ${input.passStatus},
      ${input.stage},
      ${input.meetingWhere},
      ${input.practiceField},
      ${input.company},
      ${input.resume},
      ${input.jd},
      ${input.note}
    )
    RETURNING id
  `) as { id: string }[];
  const row0 = inserted[0];
  if (!row0) throw new Error("Insert returned no row");
  const created = await getInterviewById(row0.id);
  if (!created) throw new Error("Failed to load interview after create");
  return created;
}

export async function updateInterview(id: string, patch: PatchInterviewInput): Promise<Interview | null> {
  const existing = await getInterviewById(id);
  if (!existing) return null;

  const merged = {
    profile_id: patch.profileId !== undefined ? patch.profileId : existing.profileId,
    interview_date: patch.interviewDate !== undefined ? patch.interviewDate : existing.interviewDate,
    applied_date:
      patch.appliedDate !== undefined
        ? patch.appliedDate
        : existing.appliedDate,
    booked_date:
      patch.bookedDate !== undefined ? patch.bookedDate : existing.bookedDate,
    interview_type: patch.interviewType !== undefined ? patch.interviewType : existing.interviewType,
    result: patch.result !== undefined ? patch.result : existing.result,
    pass_status: patch.passStatus !== undefined ? patch.passStatus : existing.passStatus,
    stage: patch.stage !== undefined ? patch.stage : existing.stage,
    meeting_where: patch.meetingWhere !== undefined ? patch.meetingWhere : existing.meetingWhere,
    practice_field: patch.practiceField !== undefined ? patch.practiceField : existing.practiceField,
    company: patch.company !== undefined ? patch.company : existing.company,
    resume: patch.resume !== undefined ? patch.resume : existing.resume,
    jd: patch.jd !== undefined ? patch.jd : existing.jd,
    note: patch.note !== undefined ? patch.note : existing.note,
  };

  const sql = getSql();
  await sql`
    UPDATE interviews SET
      profile_id = ${merged.profile_id}::uuid,
      interview_date = ${merged.interview_date}::date,
      applied_date = ${merged.applied_date},
      booked_date = ${merged.booked_date},
      interview_type = ${merged.interview_type},
      result = ${merged.result},
      pass_status = ${merged.pass_status},
      stage = ${merged.stage},
      meeting_where = ${merged.meeting_where},
      practice_field = ${merged.practice_field},
      company = ${merged.company},
      resume = ${merged.resume},
      jd = ${merged.jd},
      note = ${merged.note}
    WHERE id = ${id}::uuid
  `;

  return getInterviewById(id);
}

export async function deleteInterview(id: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`DELETE FROM interviews WHERE id = ${id}::uuid RETURNING id`) as { id: string }[];
  return rows.length > 0;
}
