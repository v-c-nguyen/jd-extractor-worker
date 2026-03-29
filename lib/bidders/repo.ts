import { getSql } from "@/lib/db/neon-sql";
import type { Bidder, BidderContact } from "@/lib/bidders/types";
import type { CreateBidderInput, PatchBidderInput } from "@/lib/bidders/schema";

function mapContacts(raw: unknown): BidderContact[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => {
    const o = c as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      label: String(o.label ?? ""),
      value: String(o.value ?? ""),
      sortOrder: Number(o.sortOrder ?? 0),
    };
  });
}

function mapAmount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number.parseFloat(raw);
  return Number.NaN;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date().toISOString();
}

type BidderRow = {
  id: string;
  name: string;
  country: string;
  rate_currency: string;
  rate_amount: unknown;
  status: string;
  role: string;
  note: string;
  created_at: unknown;
  updated_at: unknown;
  contacts: unknown;
};

function mapRow(row: BidderRow): Bidder {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    contacts: mapContacts(row.contacts),
    rate: {
      currency: row.rate_currency,
      amount: mapAmount(row.rate_amount),
    },
    status: row.status,
    role: row.role,
    note: row.note ?? "",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

const listSelect = `
  SELECT
    b.id,
    b.name,
    b.country,
    b.rate_currency,
    b.rate_amount,
    b.status,
    b.role,
    b.note,
    b.created_at,
    b.updated_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', c.id,
          'label', c.label,
          'value', c.value,
          'sortOrder', c.sort_order
        )
        ORDER BY c.sort_order ASC, c.id ASC
      ) FILTER (WHERE c.id IS NOT NULL),
      '[]'::json
    ) AS contacts
  FROM bidders b
  LEFT JOIN bidder_contacts c ON c.bidder_id = b.id
`;

export async function listBidders(search?: string): Promise<Bidder[]> {
  const sql = getSql();
  const q = search?.trim() ?? "";
  const rows = (await sql`
    ${sql.unsafe(listSelect)}
    WHERE (${q}::text = '' OR b.name ILIKE '%' || ${q} || '%' OR b.country ILIKE '%' || ${q} || '%')
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `) as BidderRow[];
  return rows.map((row) => mapRow(row));
}

export async function getBidderById(id: string): Promise<Bidder | null> {
  const sql = getSql();
  const rows = (await sql`
    ${sql.unsafe(listSelect)}
    WHERE b.id = ${id}::uuid
    GROUP BY b.id
  `) as BidderRow[];
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function createBidder(input: CreateBidderInput): Promise<Bidder> {
  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO bidders (name, country, rate_currency, rate_amount, status, role, note)
    VALUES (
      ${input.name},
      ${input.country},
      ${input.rateCurrency},
      ${input.rateAmount},
      ${input.status},
      ${input.role},
      ${input.note ?? ""}
    )
    RETURNING id
  `) as { id: string }[];
  const row0 = inserted[0];
  if (!row0) throw new Error("Insert returned no row");
  const newId = row0.id;
  try {
    for (let i = 0; i < input.contacts.length; i++) {
      const c = input.contacts[i];
      if (!c) continue;
      await sql`
        INSERT INTO bidder_contacts (bidder_id, label, value, sort_order)
        VALUES (${newId}, ${c.label?.trim() ?? ""}, ${c.value}, ${i})
      `;
    }
  } catch (e) {
    await sql`DELETE FROM bidders WHERE id = ${newId}`;
    throw e;
  }
  const created = await getBidderById(newId);
  if (!created) throw new Error("Failed to load bidder after create");
  return created;
}

export async function updateBidder(id: string, patch: PatchBidderInput): Promise<Bidder | null> {
  const existing = await getBidderById(id);
  if (!existing) return null;

  const sql = getSql();
  const merged = {
    name: patch.name !== undefined ? patch.name : existing.name,
    country: patch.country !== undefined ? patch.country : existing.country,
    rate_currency: patch.rateCurrency !== undefined ? patch.rateCurrency : existing.rate.currency,
    rate_amount: patch.rateAmount !== undefined ? patch.rateAmount : existing.rate.amount,
    status: patch.status !== undefined ? patch.status : existing.status,
    role: patch.role !== undefined ? patch.role : existing.role,
    note: patch.note !== undefined ? patch.note : existing.note,
  };

  const touchBidder =
    patch.name !== undefined ||
    patch.country !== undefined ||
    patch.rateCurrency !== undefined ||
    patch.rateAmount !== undefined ||
    patch.status !== undefined ||
    patch.role !== undefined ||
    patch.note !== undefined ||
    patch.contacts !== undefined;

  if (touchBidder) {
    await sql`
      UPDATE bidders SET
        name = ${merged.name},
        country = ${merged.country},
        rate_currency = ${merged.rate_currency},
        rate_amount = ${merged.rate_amount},
        status = ${merged.status},
        role = ${merged.role},
        note = ${merged.note}
      WHERE id = ${id}::uuid
    `;
  }

  if (patch.contacts !== undefined) {
    await sql`DELETE FROM bidder_contacts WHERE bidder_id = ${id}::uuid`;
    for (let i = 0; i < patch.contacts.length; i++) {
      const c = patch.contacts[i];
      if (!c) continue;
      await sql`
        INSERT INTO bidder_contacts (bidder_id, label, value, sort_order)
        VALUES (${id}, ${c.label?.trim() ?? ""}, ${c.value}, ${i})
      `;
    }
  }

  return getBidderById(id);
}

export async function deleteBidder(id: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`DELETE FROM bidders WHERE id = ${id}::uuid RETURNING id`) as { id: string }[];
  return rows.length > 0;
}
