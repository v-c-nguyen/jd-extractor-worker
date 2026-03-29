"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import type { Bidder } from "@/lib/bidders/types";
import { Loader2, Pencil, Plus, Search, Trash2, Eye, X } from "lucide-react";

const textareaClass = cn(
  "flex min-h-[88px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors",
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
);

const dialogClass =
  "w-[min(100%,32rem)] max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg backdrop:bg-black/50";

type FormState = {
  name: string;
  country: string;
  contacts: { label: string; value: string }[];
  rateCurrency: string;
  rateAmount: string;
  status: string;
  role: string;
  note: string;
  /** app_users.id UUID; empty clears link (edit only). */
  appUserId: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    country: "",
    contacts: [{ label: "", value: "" }],
    rateCurrency: "USD",
    rateAmount: "0",
    status: "Active",
    role: "",
    note: "",
    appUserId: "",
  };
}

function bidderToForm(b: Bidder): FormState {
  return {
    name: b.name,
    country: b.country,
    contacts:
      b.contacts.length > 0
        ? b.contacts.map((c) => ({ label: c.label, value: c.value }))
        : [{ label: "", value: "" }],
    rateCurrency: b.rate.currency,
    rateAmount: String(b.rate.amount),
    status: b.status,
    role: b.role,
    note: b.note,
    appUserId: b.appUserId ?? "",
  };
}

function formatRate(b: Bidder) {
  return `${b.rate.currency} ${Number(b.rate.amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })}`;
}

export function BiddersManager() {
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<Bidder | null>(null);

  const formRef = useRef<HTMLDialogElement>(null);
  const viewRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const u = new URL("/api/bidders", window.location.origin);
      if (debouncedSearch.trim()) u.searchParams.set("q", debouncedSearch.trim());
      const res = await fetch(u.toString());
      const data = (await res.json().catch(() => ({}))) as { bidders?: Bidder[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setBidders(data.bidders ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load bidders");
      setBidders([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setFormMode("create");
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    formRef.current?.showModal();
  }

  function openEdit(b: Bidder) {
    setFormMode("edit");
    setEditingId(b.id);
    setForm(bidderToForm(b));
    setFormError(null);
    formRef.current?.showModal();
  }

  function openView(b: Bidder) {
    setViewing(b);
    viewRef.current?.showModal();
  }

  function closeForm() {
    formRef.current?.close();
    setFormMode(null);
    setEditingId(null);
    setFormError(null);
  }

  function closeView() {
    viewRef.current?.close();
    setViewing(null);
  }

  function addContactRow() {
    setForm((f) => ({ ...f, contacts: [...f.contacts, { label: "", value: "" }] }));
  }

  function removeContactRow(i: number) {
    setForm((f) => ({
      ...f,
      contacts: f.contacts.filter((_, idx) => idx !== i),
    }));
  }

  function updateContact(i: number, field: "label" | "value", value: string) {
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)),
    }));
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const trimmedContacts = form.contacts
      .map((c) => ({ label: c.label.trim(), value: c.value.trim() }))
      .filter((c) => c.value.length > 0);
    if (trimmedContacts.length === 0) {
      setFormError("Add at least one contact with a value.");
      return;
    }
    if (form.rateCurrency.trim().length !== 3) {
      setFormError("Rate currency must be a 3-letter code (e.g. USD).");
      return;
    }
    const amount = Number.parseFloat(form.rateAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError("Rate amount must be a non-negative number.");
      return;
    }

    const appUserTrim = form.appUserId.trim();
    if (appUserTrim.length > 0) {
      const uuidOk =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(appUserTrim);
      if (!uuidOk) {
        setFormError("App user ID must be a valid UUID or left empty.");
        return;
      }
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      country: form.country.trim(),
      contacts: trimmedContacts.map((c) => ({
        ...(c.label ? { label: c.label } : {}),
        value: c.value,
      })),
      rateCurrency: form.rateCurrency.trim().toUpperCase(),
      rateAmount: amount,
      status: form.status.trim(),
      role: form.role.trim(),
      note: form.note.trim(),
    };
    if (formMode === "edit") {
      payload.appUserId = appUserTrim.length > 0 ? appUserTrim : null;
    }

    setSaving(true);
    try {
      if (formMode === "create") {
        const res = await fetch("/api/bidders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Create failed (${res.status})`);
      } else if (formMode === "edit" && editingId) {
        const res = await fetch(`/api/bidders/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Update failed (${res.status})`);
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeBidder(b: Bidder) {
    if (!window.confirm(`Remove bidder “${b.name}”? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/bidders/${b.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Delete failed (${res.status})`);
      }
      closeView();
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      {listError ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {listError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search by name or country…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search bidders"
          />
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" aria-hidden />
          Add bidder
        </Button>
      </div>

      <div className="rounded-md border border-border/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Country</TableHead>
              <TableHead className="hidden md:table-cell">Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </span>
                </TableCell>
              </TableRow>
            ) : bidders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No bidders yet. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              bidders.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{b.country}</TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">{formatRate(b)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{b.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden max-w-[10rem] truncate lg:table-cell">{b.role}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => openView(b)} aria-label="View details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(b)} aria-label="Edit bidder">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeBidder(b)}
                        aria-label="Delete bidder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <dialog ref={formRef} className={dialogClass} onClose={() => setFormMode(null)}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{formMode === "edit" ? "Edit bidder" : "New bidder"}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={closeForm} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form className="space-y-4" onSubmit={submitForm}>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bid-name">Name</Label>
              <Input id="bid-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bid-country">Country</Label>
              <Input id="bid-country" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bid-status">Status</Label>
              <Input id="bid-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bid-role">Role</Label>
              <Input id="bid-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bid-currency">Rate currency</Label>
              <Input
                id="bid-currency"
                maxLength={3}
                className="uppercase"
                value={form.rateCurrency}
                onChange={(e) => setForm((f) => ({ ...f, rateCurrency: e.target.value.toUpperCase() }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bid-amount">Rate amount</Label>
              <Input
                id="bid-amount"
                type="number"
                min={0}
                step="any"
                value={form.rateAmount}
                onChange={(e) => setForm((f) => ({ ...f, rateAmount: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Contacts</Label>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addContactRow}>
                <Plus className="h-3.5 w-3.5" />
                Add contact
              </Button>
            </div>
            <ul className="space-y-2">
              {form.contacts.map((c, i) => (
                <li key={i} className="flex flex-col gap-2 rounded-lg border border-border/80 p-3 sm:flex-row sm:items-end">
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Label (optional)</Label>
                      <Input
                        placeholder="e.g. Email"
                        value={c.label}
                        onChange={(e) => updateContact(i, "label", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Value</Label>
                      <Input
                        placeholder="address or phone"
                        value={c.value}
                        onChange={(e) => updateContact(i, "value", e.target.value)}
                      />
                    </div>
                  </div>
                  {form.contacts.length > 1 ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeContactRow(i)}>
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bid-note">Note</Label>
            <textarea
              id="bid-note"
              className={textareaClass}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={3}
            />
          </div>

          {formMode === "edit" ? (
            <div className="space-y-2">
              <Label htmlFor="bid-app-user">Sign-in account (app user id)</Label>
              <Input
                id="bid-app-user"
                placeholder="UUID from app_users, or empty to unlink"
                className="font-mono text-xs"
                value={form.appUserId}
                onChange={(e) => setForm((f) => ({ ...f, appUserId: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Links this bidder to a dashboard login for /me daily work. Each app user can link to at most one bidder.
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : formMode === "edit" ? (
                "Save changes"
              ) : (
                "Create bidder"
              )}
            </Button>
          </div>
        </form>
      </dialog>

      <dialog ref={viewRef} className={dialogClass} onClose={() => setViewing(null)}>
        {viewing ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{viewing.name}</h2>
                <p className="text-sm text-muted-foreground">Bidder profile</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeView} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Country</dt>
                <dd>{viewing.country}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant="secondary">{viewing.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</dt>
                <dd>{viewing.role}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rate</dt>
                <dd className="tabular-nums">{formatRate(viewing)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contacts</dt>
                <dd>
                  <ul className="mt-1 space-y-1">
                    {viewing.contacts.map((c) => (
                      <li key={c.id}>
                        {c.label ? (
                          <span className="text-muted-foreground">{c.label}: </span>
                        ) : null}
                        <span>{c.value}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              {viewing.note ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Note</dt>
                  <dd className="whitespace-pre-wrap">{viewing.note}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sign-in account</dt>
                <dd className="break-all font-mono text-xs">
                  {viewing.appUserId ?? "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  closeView();
                  openEdit(viewing);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button type="button" variant="destructive" className="gap-2" onClick={() => removeBidder(viewing)}>
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
