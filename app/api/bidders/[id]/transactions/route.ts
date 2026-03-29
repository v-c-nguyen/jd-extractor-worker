import { NextResponse } from "next/server";
import { z } from "zod";
import { getBidderById } from "@/lib/bidders/repo";
import { createBidderTransactionSchema } from "@/lib/bidders/transaction-schema";
import { createBidderTransaction, listBidderTransactions } from "@/lib/bidders/transaction-repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const uuidParam = z.string().uuid();
const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCFullYear(from.getUTCFullYear() - 3);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

const TX_SCHEMA_HINT = "Run db/migrations/004_bidder_transactions.sql on your database.";

function isTxSchemaError(msg: string): boolean {
  if (msg.includes("bidder_transactions") && msg.includes("does not exist")) return true;
  if (msg.includes("relation") && msg.includes("bidder_transactions") && msg.includes("does not exist")) {
    return true;
  }
  return false;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idOk = uuidParam.safeParse(id);
    if (!idOk.success) {
      return jsonError("Invalid bidder id", 400);
    }
    const bidder = await getBidderById(idOk.data);
    if (!bidder) {
      return jsonError("Bidder not found", 404);
    }

    const url = new URL(request.url);
    const fromQ = url.searchParams.get("from");
    const toQ = url.searchParams.get("to");
    let from: string;
    let to: string;
    if (fromQ && toQ) {
      const f = dateParam.safeParse(fromQ);
      const t = dateParam.safeParse(toQ);
      if (!f.success || !t.success) {
        return jsonError("Invalid from/to (use YYYY-MM-DD)", 400);
      }
      from = f.data;
      to = t.data;
      if (from > to) {
        return jsonError("from must be on or before to", 400);
      }
    } else {
      ({ from, to } = defaultRange());
    }

    const transactions = await listBidderTransactions(idOk.data, from, to);
    return NextResponse.json({ transactions, from, to });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list transactions";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isTxSchemaError(msg)) {
      return jsonError(`Transaction ledger is not migrated. ${TX_SCHEMA_HINT}`, 503);
    }
    console.error("[api/bidders/[id]/transactions GET]", err);
    return jsonError(msg, 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idOk = uuidParam.safeParse(id);
    if (!idOk.success) {
      return jsonError("Invalid bidder id", 400);
    }
    const bidder = await getBidderById(idOk.data);
    if (!bidder) {
      return jsonError("Bidder not found", 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const parsed = createBidderTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const row = await createBidderTransaction(idOk.data, parsed.data);
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create transaction";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isTxSchemaError(msg)) {
      return jsonError(`Transaction ledger is not migrated. ${TX_SCHEMA_HINT}`, 503);
    }
    console.error("[api/bidders/[id]/transactions POST]", err);
    return jsonError(msg, 500);
  }
}
