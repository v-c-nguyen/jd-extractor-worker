import { getSql } from "@/lib/db/neon-sql";
import type { BidderTransaction, BidderTransactionNetwork } from "@/lib/bidders/types";
import type {
  CreateBidderTransactionInput,
  PatchBidderTransactionInput,
} from "@/lib/bidders/transaction-schema";

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

function mapAmount(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function mapNetwork(v: unknown): BidderTransactionNetwork {
  const s = String(v ?? "").toUpperCase();
  if (s === "BEP20" || s === "ERC20" || s === "OTHER") return s;
  return "OTHER";
}

type TxRow = {
  id: string;
  bidder_id: string;
  occurred_on: unknown;
  entry_type: string;
  amount: unknown;
  network: unknown;
  status: string;
  tx_hash: string;
  created_at: unknown;
  updated_at: unknown;
};

function mapTxRow(row: TxRow): BidderTransaction {
  return {
    id: row.id,
    bidderId: row.bidder_id,
    occurredOn: dateOnly(row.occurred_on),
    entryType: row.entry_type,
    amount: mapAmount(row.amount),
    network: mapNetwork(row.network),
    status: row.status,
    txHash: row.tx_hash ?? "",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listBidderTransactions(
  bidderId: string,
  fromDate: string,
  toDate: string
): Promise<BidderTransaction[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      bidder_id,
      occurred_on,
      entry_type,
      amount,
      network,
      status,
      tx_hash,
      created_at,
      updated_at
    FROM bidder_transactions
    WHERE bidder_id = ${bidderId}::uuid
      AND occurred_on >= ${fromDate}::date
      AND occurred_on <= ${toDate}::date
    ORDER BY occurred_on DESC, id DESC
  `) as TxRow[];
  return rows.map(mapTxRow);
}

export async function getBidderTransactionById(
  bidderId: string,
  transactionId: string
): Promise<BidderTransaction | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      bidder_id,
      occurred_on,
      entry_type,
      amount,
      network,
      status,
      tx_hash,
      created_at,
      updated_at
    FROM bidder_transactions
    WHERE id = ${transactionId}::uuid AND bidder_id = ${bidderId}::uuid
    LIMIT 1
  `) as TxRow[];
  const row = rows[0];
  return row ? mapTxRow(row) : null;
}

export async function createBidderTransaction(
  bidderId: string,
  input: CreateBidderTransactionInput
): Promise<BidderTransaction> {
  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO bidder_transactions (
      bidder_id,
      occurred_on,
      entry_type,
      amount,
      network,
      status,
      tx_hash
    )
    VALUES (
      ${bidderId}::uuid,
      ${input.occurredOn}::date,
      ${input.entryType},
      ${input.amount},
      ${input.network},
      ${input.status},
      ${input.txHash}
    )
    RETURNING
      id,
      bidder_id,
      occurred_on,
      entry_type,
      amount,
      network,
      status,
      tx_hash,
      created_at,
      updated_at
  `) as TxRow[];
  const row0 = inserted[0];
  if (!row0) throw new Error("Insert returned no row");
  return mapTxRow(row0);
}

export async function updateBidderTransaction(
  bidderId: string,
  transactionId: string,
  patch: PatchBidderTransactionInput
): Promise<BidderTransaction | null> {
  const existing = await getBidderTransactionById(bidderId, transactionId);
  if (!existing) return null;

  const nextOn = patch.occurredOn !== undefined ? patch.occurredOn : existing.occurredOn;
  const nextType = patch.entryType !== undefined ? patch.entryType : existing.entryType;
  const nextAmount = patch.amount !== undefined ? patch.amount : existing.amount;
  const nextNetwork = patch.network !== undefined ? patch.network : existing.network;
  const nextStatus = patch.status !== undefined ? patch.status : existing.status;
  const nextHash = patch.txHash !== undefined ? patch.txHash : existing.txHash;

  const sql = getSql();
  const rows = (await sql`
    UPDATE bidder_transactions
    SET
      occurred_on = ${nextOn}::date,
      entry_type = ${nextType},
      amount = ${nextAmount},
      network = ${nextNetwork},
      status = ${nextStatus},
      tx_hash = ${nextHash}
    WHERE id = ${transactionId}::uuid AND bidder_id = ${bidderId}::uuid
    RETURNING
      id,
      bidder_id,
      occurred_on,
      entry_type,
      amount,
      network,
      status,
      tx_hash,
      created_at,
      updated_at
  `) as TxRow[];
  const row0 = rows[0];
  return row0 ? mapTxRow(row0) : null;
}

export async function deleteBidderTransaction(bidderId: string, transactionId: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM bidder_transactions
    WHERE id = ${transactionId}::uuid AND bidder_id = ${bidderId}::uuid
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}
