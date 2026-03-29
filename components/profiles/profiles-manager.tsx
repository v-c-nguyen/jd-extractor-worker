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
import type { Profile } from "@/lib/profiles/types";
import type { Bidder } from "@/lib/bidders/types";
import { Loader2, Pencil, Plus, Search, Trash2, Eye, X } from "lucide-react";

const textareaClass = cn(
  "flex min-h-[88px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors",
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
);

const selectClass = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
);

const dialogClass =
  "w-[min(100%,36rem)] max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg backdrop:bg-black/50";

const PROFILE_COUNTRY_OPTIONS = ["United States", "Philippines", "Latam", "EU", "Other"] as const;
const PROFILE_STATUS_OPTIONS = ["In Use", "Ready to Use", "Not Ready", "Other"] as const;
const PROFILE_FIELD_OPTIONS = ["FullStack", "AI/ML", "QA", "Other"] as const;

const OTHER_OPTION = "Other";

function splitPresetOther(
  stored: string,
  options: readonly string[]
): { preset: string; other: string } {
  const predefined = options.filter((o) => o !== OTHER_OPTION);
  const fallback = predefined[0] ?? OTHER_OPTION;
  const s = stored.trim();
  if (s === "") {
    return { preset: fallback, other: "" };
  }
  if (predefined.includes(s)) {
    return { preset: s, other: "" };
  }
  return { preset: OTHER_OPTION, other: stored };
}

function resolvedChoice(preset: string, other: string): string {
  return preset === OTHER_OPTION ? other.trim() : preset;
}

type FormState = {
  name: string;
  countryPreset: string;
  countryOther: string;
  statusPreset: string;
  statusOther: string;
  fieldPreset: string;
  fieldOther: string;
  linkedin: string;
  github: string;
  address: string;
  bidderId: string;
  emails: { label: string; value: string }[];
  note: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    countryPreset: PROFILE_COUNTRY_OPTIONS[0],
    countryOther: "",
    statusPreset: PROFILE_STATUS_OPTIONS[0],
    statusOther: "",
    fieldPreset: PROFILE_FIELD_OPTIONS[0],
    fieldOther: "",
    linkedin: "",
    github: "",
    address: "",
    bidderId: "",
    emails: [{ label: "", value: "" }],
    note: "",
  };
}

function profileToForm(p: Profile): FormState {
  const c = splitPresetOther(p.country, PROFILE_COUNTRY_OPTIONS);
  const st = splitPresetOther(p.status, PROFILE_STATUS_OPTIONS);
  const fi = splitPresetOther(p.field, PROFILE_FIELD_OPTIONS);
  return {
    name: p.name,
    countryPreset: c.preset,
    countryOther: c.other,
    statusPreset: st.preset,
    statusOther: st.other,
    fieldPreset: fi.preset,
    fieldOther: fi.other,
    linkedin: p.linkedin,
    github: p.github,
    address: p.address,
    bidderId: p.bidderId ?? "",
    emails:
      p.emails.length > 0
        ? p.emails.map((e) => ({ label: e.label, value: e.value }))
        : [{ label: "", value: "" }],
    note: p.note,
  };
}

export function ProfilesManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
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

  const [viewing, setViewing] = useState<Profile | null>(null);

  const formRef = useRef<HTMLDialogElement>(null);
  const viewRef = useRef<HTMLDialogElement>(null);

  const loadBidders = useCallback(async () => {
    try {
      const res = await fetch("/api/bidders");
      const data = (await res.json().catch(() => ({}))) as { bidders?: Bidder[] };
      if (res.ok) {
        setBidders(data.bidders ?? []);
      }
    } catch {
      /* optional for form */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const u = new URL("/api/profiles", window.location.origin);
      if (debouncedSearch.trim()) u.searchParams.set("q", debouncedSearch.trim());
      const res = await fetch(u.toString());
      const data = (await res.json().catch(() => ({}))) as { profiles?: Profile[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setProfiles(data.profiles ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load profiles");
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void loadBidders();
  }, [loadBidders]);

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

  function openEdit(p: Profile) {
    setFormMode("edit");
    setEditingId(p.id);
    setForm(profileToForm(p));
    setFormError(null);
    formRef.current?.showModal();
  }

  function openView(p: Profile) {
    setViewing(p);
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

  function addEmailRow() {
    setForm((f) => ({ ...f, emails: [...f.emails, { label: "", value: "" }] }));
  }

  function removeEmailRow(i: number) {
    setForm((f) => ({
      ...f,
      emails: f.emails.filter((_, idx) => idx !== i),
    }));
  }

  function updateEmail(i: number, field: "label" | "value", value: string) {
    setForm((f) => ({
      ...f,
      emails: f.emails.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)),
    }));
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedEmails = form.emails
      .map((row) => ({ label: row.label.trim(), value: row.value.trim() }))
      .filter((row) => row.value.length > 0);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const row of trimmedEmails) {
      if (!emailRegex.test(row.value)) {
        setFormError(`Invalid email: ${row.value}`);
        return;
      }
    }

    const country = resolvedChoice(form.countryPreset, form.countryOther);
    const status = resolvedChoice(form.statusPreset, form.statusOther);
    const field = resolvedChoice(form.fieldPreset, form.fieldOther);
    if (form.countryPreset === OTHER_OPTION && !country) {
      setFormError("Enter a country when “Other” is selected.");
      return;
    }
    if (form.statusPreset === OTHER_OPTION && !status) {
      setFormError("Enter a status when “Other” is selected.");
      return;
    }
    if (form.fieldPreset === OTHER_OPTION && !field) {
      setFormError("Enter a field when “Other” is selected.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      country,
      status,
      field,
      linkedin: form.linkedin.trim(),
      github: form.github.trim(),
      address: form.address.trim(),
      note: form.note.trim(),
      emails: trimmedEmails.map((row) => ({
        ...(row.label ? { label: row.label } : {}),
        value: row.value,
      })),
    };

    const bidder = form.bidderId.trim();
    payload.bidderId = bidder.length > 0 ? bidder : null;

    setSaving(true);
    try {
      if (formMode === "create") {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Create failed (${res.status})`);
      } else if (formMode === "edit" && editingId) {
        const res = await fetch(`/api/profiles/${editingId}`, {
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

  async function removeProfile(p: Profile) {
    if (!window.confirm(`Remove profile “${p.name}”? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/profiles/${p.id}`, { method: "DELETE" });
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
            placeholder="Search by name, country, status, field, or bidder…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search profiles"
          />
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" aria-hidden />
          Add profile
        </Button>
      </div>

      <div className="rounded-md border border-border/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Country</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Field</TableHead>
              <TableHead className="hidden lg:table-cell">Bidder</TableHead>
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
            ) : profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No profiles yet. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{p.country || "—"}</TableCell>
                  <TableCell>
                    {p.status ? <Badge variant="secondary">{p.status}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden max-w-[10rem] truncate md:table-cell">{p.field || "—"}</TableCell>
                  <TableCell className="hidden max-w-[10rem] truncate text-muted-foreground lg:table-cell">
                    {p.bidderName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => openView(p)} aria-label="View details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Edit profile">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeProfile(p)}
                        aria-label="Delete profile"
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
          <h2 className="text-lg font-semibold">{formMode === "edit" ? "Edit profile" : "New profile"}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={closeForm} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form className="space-y-4" onSubmit={submitForm}>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-name">Name</Label>
              <Input id="prof-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prof-country">Country</Label>
              <select
                id="prof-country"
                className={selectClass}
                value={form.countryPreset}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    countryPreset: e.target.value,
                    countryOther: e.target.value === OTHER_OPTION ? f.countryOther : "",
                  }))
                }
              >
                {PROFILE_COUNTRY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {form.countryPreset === OTHER_OPTION ? (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="prof-country-other" className="text-xs text-muted-foreground">
                    Specify country
                  </Label>
                  <Input
                    id="prof-country-other"
                    placeholder="e.g. Canada"
                    value={form.countryOther}
                    onChange={(e) => setForm((f) => ({ ...f, countryOther: e.target.value }))}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="prof-status">Status</Label>
              <select
                id="prof-status"
                className={selectClass}
                value={form.statusPreset}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    statusPreset: e.target.value,
                    statusOther: e.target.value === OTHER_OPTION ? f.statusOther : "",
                  }))
                }
              >
                {PROFILE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {form.statusPreset === OTHER_OPTION ? (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="prof-status-other" className="text-xs text-muted-foreground">
                    Specify status
                  </Label>
                  <Input
                    id="prof-status-other"
                    placeholder="e.g. On hold"
                    value={form.statusOther}
                    onChange={(e) => setForm((f) => ({ ...f, statusOther: e.target.value }))}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-field">Field</Label>
              <select
                id="prof-field"
                className={selectClass}
                value={form.fieldPreset}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    fieldPreset: e.target.value,
                    fieldOther: e.target.value === OTHER_OPTION ? f.fieldOther : "",
                  }))
                }
              >
                {PROFILE_FIELD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {form.fieldPreset === OTHER_OPTION ? (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="prof-field-other" className="text-xs text-muted-foreground">
                    Specify field
                  </Label>
                  <Input
                    id="prof-field-other"
                    placeholder="e.g. DevOps"
                    value={form.fieldOther}
                    onChange={(e) => setForm((f) => ({ ...f, fieldOther: e.target.value }))}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-bidder">Bidder (registered)</Label>
              <select
                id="prof-bidder"
                className={selectClass}
                value={form.bidderId}
                onChange={(e) => setForm((f) => ({ ...f, bidderId: e.target.value }))}
              >
                <option value="">None</option>
                {bidders.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-linkedin">LinkedIn</Label>
              <Input
                id="prof-linkedin"
                placeholder="URL or handle"
                value={form.linkedin}
                onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-github">GitHub</Label>
              <Input
                id="prof-github"
                placeholder="URL or username"
                value={form.github}
                onChange={(e) => setForm((f) => ({ ...f, github: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Emails</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addEmailRow}>
                  <Plus className="h-3.5 w-3.5" />
                  Add email
                </Button>
              </div>
              <ul className="space-y-2">
                {form.emails.map((row, i) => (
                  <li key={i} className="flex flex-col gap-2 rounded-lg border border-border/80 p-3 sm:flex-row sm:items-end">
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Label (optional)</Label>
                        <Input
                          placeholder="e.g. Work"
                          value={row.label}
                          onChange={(e) => updateEmail(i, "label", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Email</Label>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="name@example.com"
                          value={row.value}
                          onChange={(e) => updateEmail(i, "value", e.target.value)}
                        />
                      </div>
                    </div>
                    {form.emails.length > 1 ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeEmailRow(i)}>
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-address">Address</Label>
              <textarea
                id="prof-address"
                className={textareaClass}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-note">Note</Label>
              <textarea
                id="prof-note"
                className={textareaClass}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

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
                "Create profile"
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
                <p className="text-sm text-muted-foreground">Profile</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeView} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Country</dt>
                <dd>{viewing.country || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</dt>
                <dd>
                  {viewing.status ? <Badge variant="secondary">{viewing.status}</Badge> : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Field</dt>
                <dd>{viewing.field || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bidder</dt>
                <dd>{viewing.bidderName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">LinkedIn</dt>
                <dd className="break-all">{viewing.linkedin || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">GitHub</dt>
                <dd className="break-all">{viewing.github || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Emails</dt>
                <dd>
                  {viewing.emails.length === 0 ? (
                    "—"
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {viewing.emails.map((e) => (
                        <li key={e.id}>
                          {e.label ? <span className="text-muted-foreground">{e.label}: </span> : null}
                          <span>{e.value}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</dt>
                <dd className="whitespace-pre-wrap">{viewing.address || "—"}</dd>
              </div>
              {viewing.note ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Note</dt>
                  <dd className="whitespace-pre-wrap">{viewing.note}</dd>
                </div>
              ) : null}
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
              <Button type="button" variant="destructive" className="gap-2" onClick={() => removeProfile(viewing)}>
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
