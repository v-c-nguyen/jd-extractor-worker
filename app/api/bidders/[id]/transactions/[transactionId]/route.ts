import { NextResponse } from "next/server";
import { z } from "zod";
import { getBidderById } from "@/lib/bidders/repo";
import { patchBidderTransactionSchema } from "@/lib/bidders/transaction-schema";
import { deleteBidderTransaction, updateBidderTransaction } from "@/lib/bidders/transaction-repo";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const uuidParam = z.string().uuid();

const TX_SCHEMA_HINT = "Run db/migrations/004_bidder_transactions.sql on your database.";

function isTxSchemaError(msg: string): boolean {
  if (msg.includes("bidder_transactions") && msg.includes("does not exist")) return true;
  if (msg.includes("relation") && msg.includes("bidder_transactions") && msg.includes("does not exist")) {
    return true;
  }
  return false;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  try {
    const { id, transactionId } = await params;
    const idOk = uuidParam.safeParse(id);
    const tOk = uuidParam.safeParse(transactionId);
    if (!idOk.success || !tOk.success) {
      return jsonError("Invalid id", 400);
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
    const parsed = patchBidderTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const row = await updateBidderTransaction(idOk.data, tOk.data, parsed.data);
    if (!row) {
      return jsonError("Transaction not found", 404);
    }
    return NextResponse.json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update transaction";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isTxSchemaError(msg)) {
      return jsonError(`Transaction ledger is not migrated. ${TX_SCHEMA_HINT}`, 503);
    }
    console.error("[api/bidders/[id]/transactions/[transactionId] PATCH]", err);
    return jsonError(msg, 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  try {
    const { id, transactionId } = await params;
    const idOk = uuidParam.safeParse(id);
    const tOk = uuidParam.safeParse(transactionId);
    if (!idOk.success || !tOk.success) {
      return jsonError("Invalid id", 400);
    }
    const bidder = await getBidderById(idOk.data);
    if (!bidder) {
      return jsonError("Bidder not found", 404);
    }

    const removed = await deleteBidderTransaction(idOk.data, tOk.data);
    if (!removed) {
      return jsonError("Transaction not found", 404);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete transaction";
    if (msg.includes("DATABASE_URL")) {
      return jsonError("Database is not configured (set DATABASE_URL).", 503);
    }
    if (isTxSchemaError(msg)) {
      return jsonError(`Transaction ledger is not migrated. ${TX_SCHEMA_HINT}`, 503);
    }
    console.error("[api/bidders/[id]/transactions/[transactionId] DELETE]", err);
    return jsonError(msg, 500);
  }
}
