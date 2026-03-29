"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  Bidder,
  BidderTransaction,
  BidderTransactionNetwork,
  BidderTransactionStatus,
} from "@/lib/bidders/types";
import { Loader2, Pencil, Trash2 } from "lucide-react";

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function rangeForHistory(): { from: string; to: string } {
  const to = todayIsoUtc();
  const d = new Date(to + "T12:00:00.000Z");
  d.setUTCFullYear(d.getUTCFullYear() - 3);
  return { from: d.toISOString().slice(0, 10), to };
}

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const s = n.toFixed(8).replace(/\.?0+$/, "");
  return s === "" ? "0" : s;
}

function shortHash(h: string): string {
  const t = h.trim();
  if (t.length <= 18) return t;
  return `${t.slice(0, 10)}…${t.slice(-8)}`;
}

const NETWORK_OPTIONS: { value: BidderTransactionNetwork; label: string }[] = [
  { value: "BEP20", label: "BEP20" },
  { value: "ERC20", label: "ERC20" },
  { value: "OTHER", label: "Other" },
];

const STATUS_OPTIONS: { value: BidderTransactionStatus; label: string }[] = [
  { value: "Pending", label: "Pending" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Paid", label: "Paid" },
];

function statusBadgeVariant(status: BidderTransactionStatus): "outline" | "secondary" {
  if (status === "Paid") return "outline";
  if (status === "Confirmed") return "outline";
  return "secondary";
}

function emptyForm() {
  return {
    occurredOn: todayIsoUtc(),
    entryType: "",
    amountStr: "",
    network: "OTHER" as BidderTransactionNetwork,
    status: "Pending" as BidderTransactionStatus,
    txHash: "",
  };
}

export function BidderTransactionSection() {
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [biddersLoading, setBiddersLoading] = useState(true);
  const [biddersError, setBiddersError] = useState<string | null>(null);

  const [bidderId, setBidderId] = useState("");
  const [transactions, setTransactions] = useState<BidderTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedBidderName = useMemo(
    () => bidders.find((b) => b.id === bidderId)?.name ?? "",
    [bidders, bidderId]
  );

  const loadBidders = useCallback(async () => {
    setBiddersLoading(true);
    setBiddersError(null);
    try {
      const res = await fetch("/api/bidders");
      const data = (await res.json().catch(() => ({}))) as { bidders?: Bidder[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setBidders(data.bidders ?? []);
    } catch (e) {
      setBiddersError(e instanceof Error ? e.message : "Failed to load bidders");
      setBidders([]);
    } finally {
      setBiddersLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async (id: string) => {
    if (!id) return;
    setTxLoading(true);
    setTxError(null);
    try {
      const { from, to } = rangeForHistory();
      const u = new URL(`/api/bidders/${id}/transactions`, window.location.origin);
      u.searchParams.set("from", from);
      u.searchParams.set("to", to);
      const res = await fetch(u.toString());
      const data = (await res.json().catch(() => ({}))) as {
        transactions?: BidderTransaction[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setTransactions(data.transactions ?? []);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Failed to load transactions");
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBidders();
  }, [loadBidders]);

  useEffect(() => {
    if (bidderId) void loadTransactions(bidderId);
    else {
      setTransactions([]);
      setEditingId(null);
      setForm(emptyForm());
    }
  }, [bidderId, loadTransactions]);

  function startNew() {
    setEditingId(null);
    setForm(emptyForm());
    setSaveError(null);
  }

  function startEdit(row: BidderTransaction) {
    setEditingId(row.id);
    setForm({
      occurredOn: row.occurredOn,
      entryType: row.entryType,
      amountStr: formatAmount(row.amount),
      network: row.network,
      status: row.status,
      txHash: row.txHash,
    });
    setSaveError(null);
  }

  function parseAmount(): number | null {
    const raw = form.amountStr.trim();
    if (raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }

  async function save() {
    if (!bidderId) return;
    const amount = parseAmount();
    if (amount === null) {
      setSaveError("Enter a valid non-negative amount.");
      return;
    }
    if (!form.entryType.trim()) {
      setSaveError("Type is required.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        occurredOn: form.occurredOn,
        entryType: form.entryType.trim(),
        amount,
        network: form.network,
        status: form.status,
        txHash: form.txHash.trim(),
      };
      if (editingId) {
        const res = await fetch(`/api/bidders/${bidderId}/transactions/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Update failed (${res.status})`);
      } else {
        const res = await fetch(`/api/bidders/${bidderId}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Create failed (${res.status})`);
      }
      await loadTransactions(bidderId);
      startNew();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!bidderId || !editingId) return;
    if (!window.confirm("Remove this transaction from the ledger?")) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/bidders/${bidderId}/transactions/${editingId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Delete failed (${res.status})`);
      }
      await loadTransactions(bidderId);
      startNew();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {biddersError ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {biddersError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="tx-bidder">Bidder</Label>
          <select
            id="tx-bidder"
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            value={bidderId}
            onChange={(e) => setBidderId(e.target.value)}
            disabled={biddersLoading}
          >
            <option value="">{biddersLoading ? "Loading…" : "Select a bidder"}</option>
            {bidders.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        {bidderId ? (
          <p className="text-sm text-muted-foreground sm:text-right">
            Ledger for <span className="font-medium text-foreground">{selectedBidderName}</span>
          </p>
        ) : null}
      </div>

      {!bidderId ? (
        <p className="text-sm text-muted-foreground">Choose a bidder to browse, add, edit, or remove transactions.</p>
      ) : txError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {txError}
        </p>
      ) : (
        <>
          <div className="space-y-4 rounded-xl border border-border/80 bg-muted/15 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{editingId ? "Edit transaction" : "Add transaction"}</h3>
              {editingId ? (
                <Button type="button" variant="ghost" size="sm" onClick={startNew} disabled={saving}>
                  New instead
                </Button>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tx-date">Date</Label>
                <Input
                  id="tx-date"
                  type="date"
                  value={form.occurredOn}
                  onChange={(e) => setForm((f) => ({ ...f, occurredOn: e.target.value }))}
                  disabled={txLoading || saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tx-type">Type</Label>
                <Input
                  id="tx-type"
                  placeholder="e.g. Placement fee, Retainer, USDT payout"
                  value={form.entryType}
                  onChange={(e) => setForm((f) => ({ ...f, entryType: e.target.value }))}
                  disabled={txLoading || saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tx-amount">Amount</Label>
                <Input
                  id="tx-amount"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.amountStr}
                  onChange={(e) => setForm((f) => ({ ...f, amountStr: e.target.value }))}
                  disabled={txLoading || saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tx-network">Token / network</Label>
                <select
                  id="tx-network"
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  value={form.network}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, network: e.target.value as BidderTransactionNetwork }))
                  }
                  disabled={txLoading || saving}
                >
                  {NETWORK_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tx-status">Status</Label>
                <select
                  id="tx-status"
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as BidderTransactionStatus }))
                  }
                  disabled={txLoading || saving}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="tx-hash">Transaction hash</Label>
                <Input
                  id="tx-hash"
                  placeholder="On-chain reference (optional for fiat or pending)"
                  value={form.txHash}
                  onChange={(e) => setForm((f) => ({ ...f, txHash: e.target.value }))}
                  disabled={txLoading || saving}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="gap-2"
                onClick={() => void save()}
                disabled={txLoading || saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : editingId ? (
                  "Save changes"
                ) : (
                  "Add transaction"
                )}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={() => void remove()}
                  disabled={txLoading || saving}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">History (newest first)</h3>
            {txLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading…
              </p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet. Add one above.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="hidden md:table-cell">Bidder</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
                      <TableHead className="hidden sm:table-cell whitespace-nowrap">Network</TableHead>
                      <TableHead className="hidden lg:table-cell whitespace-nowrap">Status</TableHead>
                      <TableHead className="hidden xl:table-cell min-w-[10rem]">Tx hash</TableHead>
                      <TableHead className="w-[1%] text-right"> </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((row) => {
                      const active = row.id === editingId;
                      return (
                        <TableRow
                          key={row.id}
                          className={cn(active && "bg-muted/50")}
                          data-state={active ? "selected" : undefined}
                        >
                          <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                            {row.occurredOn}
                          </TableCell>
                          <TableCell className="font-medium">{row.entryType}</TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">
                            {selectedBidderName}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">
                            {formatAmount(row.amount)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline">{row.network}</Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                          </TableCell>
                          <TableCell
                            className="hidden max-w-[14rem] truncate font-mono text-xs text-muted-foreground xl:table-cell"
                            title={row.txHash || undefined}
                          >
                            {row.txHash ? shortHash(row.txHash) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Edit transaction ${row.occurredOn}`}
                              onClick={() => startEdit(row)}
                              disabled={saving}
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="text-xs text-muted-foreground xl:hidden">
              Tip: widen the window to see status and full transaction hash column.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
