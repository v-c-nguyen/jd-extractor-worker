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
