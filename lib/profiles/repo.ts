import { getSql } from "@/lib/db/neon-sql";
import type { Profile, ProfileEmail } from "@/lib/profiles/types";
import type { CreateProfileInput, PatchProfileInput } from "@/lib/profiles/schema";

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

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date().toISOString();
}

type ProfileRow = {
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
  created_at: unknown;
  updated_at: unknown;
  emails: unknown;
};

function mapRow(row: ProfileRow): Profile {
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
    )
    GROUP BY p.id, b.name
    ORDER BY p.created_at DESC
  `) as ProfileRow[];
  return rows.map((row) => mapRow(row));
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const sql = getSql();
  const rows = (await sql`
    ${sql.unsafe(listSelect)}
    WHERE p.id = ${id}::uuid
    GROUP BY p.id, b.name
  `) as ProfileRow[];
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO profiles (
      name, country, status, field, linkedin, github, address, bidder_id, note
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
      ${input.note ?? ""}
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
    bidder_id:
      patch.bidderId !== undefined ? patch.bidderId : existing.bidderId,
    note: patch.note !== undefined ? patch.note : existing.note,
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
        note = ${merged.note}
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
