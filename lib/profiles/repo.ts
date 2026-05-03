import { getSql } from "@/lib/db/neon-sql";
import { normalizeSqlDate } from "@/lib/profiles/format-dob";
import type { Profile, ProfileAttachmentMeta, ProfileEmail } from "@/lib/profiles/types";
import type { CreateProfileInput, PatchProfileInput } from "@/lib/profiles/schema";

export const PROFILE_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_ATTACHMENT_MAX_COUNT = 20;
export const PROFILE_ATTACHMENT_ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function mapEmails(raw: unknown): ProfileEmail[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e) => {
    const o = e as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      label: String(o.label ?? ""),
      value: String(o.value ?? ""),
      sortOrder: Number(o.sortOrder ?? 0),
    };
  });
}

function mapAttachmentMetaRows(
  rows: { id: string; original_name: string; mime_type: string; created_at: unknown }[]
): ProfileAttachmentMeta[] {
  return rows.map((r) => ({
    id: r.id,
    originalName: r.original_name,
    mimeType: r.mime_type,
    createdAt: toIso(r.created_at),
  }));
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date().toISOString();
}

type ProfileListRow = {
  id: string;
  name: string;
  country: string;
  status: string;
  field: string;
  linkedin: string;
  github: string;
  address: string;
  bidder_id: string | null;
  bidder_name: string | null;
  note: string;
  date_of_birth: unknown;
  created_at: unknown;
  updated_at: unknown;
  emails: unknown;
};

type ProfileDetailRow = ProfileListRow & {
  ssn_number: string;
  dl_number: string;
  additional_information: string;
};

function mapListRow(row: ProfileListRow): Profile {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    status: row.status,
    field: row.field,
    linkedin: row.linkedin,
    github: row.github,
    address: row.address,
    bidderId: row.bidder_id,
    bidderName: row.bidder_name,
    emails: mapEmails(row.emails),
    note: row.note ?? "",
    dateOfBirth: normalizeSqlDate(row.date_of_birth),
    ssnNumber: "",
    dlNumber: "",
    additionalInformation: "",
    attachments: [],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapDetailRow(row: ProfileDetailRow, attachments: ProfileAttachmentMeta[]): Profile {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    status: row.status,
    field: row.field,
    linkedin: row.linkedin,
    github: row.github,
    address: row.address,
    bidderId: row.bidder_id,
    bidderName: row.bidder_name,
    emails: mapEmails(row.emails),
    note: row.note ?? "",
    dateOfBirth: normalizeSqlDate(row.date_of_birth),
    ssnNumber: row.ssn_number ?? "",
    dlNumber: row.dl_number ?? "",
    additionalInformation: row.additional_information ?? "",
    attachments,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

const listSelect = `
  SELECT
    p.id,
    p.name,
    p.country,
    p.status,
    p.field,
    p.linkedin,
    p.github,
    p.address,
    p.bidder_id,
    b.name AS bidder_name,
    p.note,
    p.date_of_birth,
    p.created_at,
    p.updated_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', e.id,
          'label', e.label,
          'value', e.value,
          'sortOrder', e.sort_order
        )
        ORDER BY e.sort_order ASC, e.id ASC
      ) FILTER (WHERE e.id IS NOT NULL),
      '[]'::json
    ) AS emails
  FROM profiles p
  LEFT JOIN bidders b ON b.id = p.bidder_id
  LEFT JOIN profile_emails e ON e.profile_id = p.id
`;

const profileDetailSelect = `
  SELECT
    p.id,
    p.name,
    p.country,
    p.status,
    p.field,
    p.linkedin,
    p.github,
    p.address,
    p.bidder_id,
    b.name AS bidder_name,
    p.note,
    p.date_of_birth,
    p.ssn_number,
    p.dl_number,
    p.additional_information,
    p.created_at,
    p.updated_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', e.id,
          'label', e.label,
          'value', e.value,
          'sortOrder', e.sort_order
        )
        ORDER BY e.sort_order ASC, e.id ASC
      ) FILTER (WHERE e.id IS NOT NULL),
      '[]'::json
    ) AS emails
  FROM profiles p
  LEFT JOIN bidders b ON b.id = p.bidder_id
  LEFT JOIN profile_emails e ON e.profile_id = p.id
`;

export async function listProfiles(search?: string): Promise<Profile[]> {
  const sql = getSql();
  const q = search?.trim() ?? "";
  const rows = (await sql`
    ${sql.unsafe(listSelect)}
    WHERE (
      ${q}::text = ''
      OR p.name ILIKE '%' || ${q} || '%'
      OR p.country ILIKE '%' || ${q} || '%'
      OR p.status ILIKE '%' || ${q} || '%'
      OR p.field ILIKE '%' || ${q} || '%'
      OR COALESCE(b.name, '') ILIKE '%' || ${q} || '%'
      OR p.additional_information ILIKE '%' || ${q} || '%'
      OR (p.date_of_birth IS NOT NULL AND p.date_of_birth::text ILIKE '%' || ${q} || '%')
    )
    GROUP BY p.id, b.name
    ORDER BY p.created_at DESC
  `) as ProfileListRow[];
  return rows.map((row) => mapListRow(row));
}

export async function listProfilesForBidder(
  bidderId: string
): Promise<{ id: string; name: string }[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, name
    FROM profiles
    WHERE bidder_id = ${bidderId}::uuid
    ORDER BY lower(name) ASC, id ASC
  `) as { id: string; name: string }[];
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const sql = getSql();
  const rows = (await sql`
    ${sql.unsafe(profileDetailSelect)}
    WHERE p.id = ${id}::uuid
    GROUP BY p.id, b.name
  `) as ProfileDetailRow[];
  const row = rows[0];
  if (!row) return null;

  const metaRows = (await sql`
    SELECT id, original_name, mime_type, created_at
    FROM profile_attachments
    WHERE profile_id = ${id}::uuid
    ORDER BY created_at ASC, id ASC
  `) as { id: string; original_name: string; mime_type: string; created_at: unknown }[];

  return mapDetailRow(row, mapAttachmentMetaRows(metaRows));
}

export async function countProfileAttachments(profileId: string): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    SELECT COUNT(*)::int AS c
    FROM profile_attachments
    WHERE profile_id = ${profileId}::uuid
  `) as { c: number }[];
  return rows[0]?.c ?? 0;
}

export async function insertProfileAttachment(params: {
  profileId: string;
  originalName: string;
  mimeType: string;
  fileData: Buffer;
}): Promise<ProfileAttachmentMeta> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO profile_attachments (profile_id, original_name, mime_type, file_data)
    VALUES (
      ${params.profileId}::uuid,
      ${params.originalName},
      ${params.mimeType},
      ${params.fileData}
    )
    RETURNING id, original_name, mime_type, created_at
  `) as { id: string; original_name: string; mime_type: string; created_at: unknown }[];
  const r = rows[0];
  if (!r) throw new Error("Attachment insert returned no row");
  return {
    id: r.id,
    originalName: r.original_name,
    mimeType: r.mime_type,
    createdAt: toIso(r.created_at),
  };
}

export async function getProfileAttachmentFile(
  profileId: string,
  attachmentId: string
): Promise<{ fileData: Buffer; mimeType: string; originalName: string } | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT file_data, mime_type, original_name
    FROM profile_attachments
    WHERE id = ${attachmentId}::uuid AND profile_id = ${profileId}::uuid
  `) as { file_data: unknown; mime_type: string; original_name: string }[];
  const row = rows[0];
  if (!row) return null;
  const raw = row.file_data;
  const buf =
    raw instanceof Buffer
      ? raw
      : raw instanceof Uint8Array
        ? Buffer.from(raw)
        : typeof raw === "string"
          ? Buffer.from(raw, "base64")
          : null;
  if (!buf) return null;
  return { fileData: buf, mimeType: row.mime_type, originalName: row.original_name };
}

export async function deleteProfileAttachment(profileId: string, attachmentId: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM profile_attachments
    WHERE id = ${attachmentId}::uuid AND profile_id = ${profileId}::uuid
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO profiles (
      name, country, status, field, linkedin, github, address, bidder_id, note,
      date_of_birth,
      ssn_number, dl_number, additional_information
    )
    VALUES (
      ${input.name},
      ${input.country},
      ${input.status},
      ${input.field},
      ${input.linkedin},
      ${input.github},
      ${input.address},
      ${input.bidderId ?? null},
      ${input.note ?? ""},
      ${input.dateOfBirth?.trim() ? input.dateOfBirth.trim() : null},
      ${input.ssnNumber ?? ""},
      ${input.dlNumber ?? ""},
      ${input.additionalInformation ?? ""}
    )
    RETURNING id
  `) as { id: string }[];
  const row0 = inserted[0];
  if (!row0) throw new Error("Insert returned no row");
  const newId = row0.id;
  try {
    for (let i = 0; i < input.emails.length; i++) {
      const em = input.emails[i];
      if (!em) continue;
      await sql`
        INSERT INTO profile_emails (profile_id, label, value, sort_order)
        VALUES (${newId}, ${em.label?.trim() ?? ""}, ${em.value}, ${i})
      `;
    }
  } catch (e) {
    await sql`DELETE FROM profiles WHERE id = ${newId}`;
    throw e;
  }
  const created = await getProfileById(newId);
  if (!created) throw new Error("Failed to load profile after create");
  return created;
}

export async function updateProfile(id: string, patch: PatchProfileInput): Promise<Profile | null> {
  const existing = await getProfileById(id);
  if (!existing) return null;

  const sql = getSql();
  const merged = {
    name: patch.name !== undefined ? patch.name : existing.name,
    country: patch.country !== undefined ? patch.country : existing.country,
    status: patch.status !== undefined ? patch.status : existing.status,
    field: patch.field !== undefined ? patch.field : existing.field,
    linkedin: patch.linkedin !== undefined ? patch.linkedin : existing.linkedin,
    github: patch.github !== undefined ? patch.github : existing.github,
    address: patch.address !== undefined ? patch.address : existing.address,
    bidder_id: patch.bidderId !== undefined ? patch.bidderId : existing.bidderId,
    note: patch.note !== undefined ? patch.note : existing.note,
    date_of_birth:
      patch.dateOfBirth !== undefined
        ? patch.dateOfBirth.trim() === ""
          ? null
          : patch.dateOfBirth.trim()
        : existing.dateOfBirth.trim() === ""
          ? null
          : existing.dateOfBirth.trim(),
    ssn_number: patch.ssnNumber !== undefined ? patch.ssnNumber : existing.ssnNumber,
    dl_number: patch.dlNumber !== undefined ? patch.dlNumber : existing.dlNumber,
    additional_information:
      patch.additionalInformation !== undefined
        ? patch.additionalInformation
        : existing.additionalInformation,
  };

  const touchProfile =
    patch.name !== undefined ||
    patch.country !== undefined ||
    patch.status !== undefined ||
    patch.field !== undefined ||
    patch.linkedin !== undefined ||
    patch.github !== undefined ||
    patch.address !== undefined ||
    patch.bidderId !== undefined ||
    patch.note !== undefined ||
    patch.dateOfBirth !== undefined ||
    patch.ssnNumber !== undefined ||
    patch.dlNumber !== undefined ||
    patch.additionalInformation !== undefined ||
    patch.emails !== undefined;

  if (touchProfile) {
    await sql`
      UPDATE profiles SET
        name = ${merged.name},
        country = ${merged.country},
        status = ${merged.status},
        field = ${merged.field},
        linkedin = ${merged.linkedin},
        github = ${merged.github},
        address = ${merged.address},
        bidder_id = ${merged.bidder_id},
        note = ${merged.note},
        date_of_birth = ${merged.date_of_birth},
        ssn_number = ${merged.ssn_number},
        dl_number = ${merged.dl_number},
        additional_information = ${merged.additional_information}
      WHERE id = ${id}::uuid
    `;
  }

  if (patch.emails !== undefined) {
    await sql`DELETE FROM profile_emails WHERE profile_id = ${id}::uuid`;
    for (let i = 0; i < patch.emails.length; i++) {
      const em = patch.emails[i];
      if (!em) continue;
      await sql`
        INSERT INTO profile_emails (profile_id, label, value, sort_order)
        VALUES (${id}, ${em.label?.trim() ?? ""}, ${em.value}, ${i})
      `;
    }
  }

  return getProfileById(id);
}

export async function deleteProfile(id: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`DELETE FROM profiles WHERE id = ${id}::uuid RETURNING id`) as { id: string }[];
  return rows.length > 0;
}
