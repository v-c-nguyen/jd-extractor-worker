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
import type { Interview } from "@/lib/interviews/types";
import type { Profile } from "@/lib/profiles/types";
import {
  interviewPassStatusValues,
  interviewResultValues,
  interviewStageValues,
} from "@/lib/interviews/schema";
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
  "w-[min(100%,42rem)] max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg backdrop:bg-black/50";

const INTERVIEW_TYPE_OPTIONS = ["New", "Next Step", "Rescheduled", "Other"] as const;
const MEETING_WHERE_OPTIONS = ["Phone", "G-Meet", "Teams", "Zoom", "Other"] as const;
const PRACTICE_FIELD_OPTIONS = ["FullStack", "AI", "QA", "Other"] as const;

const OTHER_OPTION = "Other";

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

function dateInputValue(isoOrYmd: string | null | undefined): string {
  if (!isoOrYmd) return "";
  const s = isoOrYmd.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

type FormState = {
  profileId: string;
  interviewDate: string;
  appliedDate: string;
  bookedDate: string;
  typePreset: string;
  typeOther: string;
  result: (typeof interviewResultValues)[number];
  passStatus: (typeof interviewPassStatusValues)[number];
  stage: (typeof interviewStageValues)[number];
  wherePreset: string;
  whereOther: string;
  fieldPreset: string;
  fieldOther: string;
  company: string;
  resume: string;
  jd: string;
  note: string;
};

function emptyForm(): FormState {
  return {
    profileId: "",
    interviewDate: "",
    appliedDate: "",
    bookedDate: todayYmd(),
    typePreset: INTERVIEW_TYPE_OPTIONS[0],
    typeOther: "",
    result: interviewResultValues[0],
    passStatus: interviewPassStatusValues[0],
    stage: interviewStageValues[0],
    wherePreset: MEETING_WHERE_OPTIONS[0],
    whereOther: "",
    fieldPreset: PRACTICE_FIELD_OPTIONS[0],
    fieldOther: "",
    company: "",
    resume: "",
    jd: "",
    note: "",
  };
}

function interviewToForm(i: Interview): FormState {
  const t = splitPresetOther(i.interviewType, INTERVIEW_TYPE_OPTIONS);
  const w = splitPresetOther(i.meetingWhere, MEETING_WHERE_OPTIONS);
  const f = splitPresetOther(i.practiceField, PRACTICE_FIELD_OPTIONS);
  return {
    profileId: i.profileId,
    interviewDate: dateInputValue(i.interviewDate),
    appliedDate: dateInputValue(i.appliedDate),
    bookedDate: dateInputValue(i.bookedDate),
    typePreset: t.preset,
    typeOther: t.other,
    result: i.result as FormState["result"],
    passStatus: i.passStatus as FormState["passStatus"],
    stage: i.stage as FormState["stage"],
    wherePreset: w.preset,
    whereOther: w.other,
    fieldPreset: f.preset,
    fieldOther: f.other,
    company: i.company,
    resume: i.resume,
    jd: i.jd,
    note: i.note,
  };
}

function buildPayload(form: FormState): Record<string, unknown> {
  const interviewType = resolvedChoice(form.typePreset, form.typeOther);
  const meetingWhere = resolvedChoice(form.wherePreset, form.whereOther);
  const practiceField = resolvedChoice(form.fieldPreset, form.fieldOther);
  return {
    profileId: form.profileId,
    interviewDate: form.interviewDate,
    appliedDate: form.appliedDate.trim() === "" ? null : form.appliedDate.trim(),
    bookedDate: form.bookedDate.trim() === "" ? null : form.bookedDate.trim(),
    interviewType,
    result: form.result,
    passStatus: form.passStatus,
    stage: form.stage,
    meetingWhere,
    practiceField,
    company: form.company.trim(),
    resume: form.resume.trim(),
    jd: form.jd.trim(),
    note: form.note.trim(),
  };
}

export function InterviewsManager() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<Interview | null>(null);

  const formRef = useRef<HTMLDialogElement>(null);
  const viewRef = useRef<HTMLDialogElement>(null);

  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/profiles");
      const data = (await res.json().catch(() => ({}))) as { profiles?: Profile[] };
      if (res.ok) {
        setProfiles(data.profiles ?? []);
      }
    } catch {
      /* form still usable if list fails */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const u = new URL("/api/interviews", window.location.origin);
      if (debouncedSearch.trim()) u.searchParams.set("q", debouncedSearch.trim());
      const res = await fetch(u.toString());
      const data = (await res.json().catch(() => ({}))) as { interviews?: Interview[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setInterviews(data.interviews ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load interviews");
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

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

  function openEdit(i: Interview) {
    setFormMode("edit");
    setEditingId(i.id);
    setForm(interviewToForm(i));
    setFormError(null);
    formRef.current?.showModal();
  }

  function openView(i: Interview) {
    setViewing(i);
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

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.profileId.trim()) {
      setFormError("Select a profile.");
      return;
    }

    const interviewType = resolvedChoice(form.typePreset, form.typeOther);
    if (form.typePreset === OTHER_OPTION && !interviewType) {
      setFormError('Enter a type when “Other” is selected.');
      return;
    }
    const meetingWhere = resolvedChoice(form.wherePreset, form.whereOther);
    if (form.wherePreset === OTHER_OPTION && !meetingWhere) {
      setFormError('Enter a location when “Where: Other” is selected.');
      return;
    }
    const practiceField = resolvedChoice(form.fieldPreset, form.fieldOther);
    if (form.fieldPreset === OTHER_OPTION && !practiceField) {
      setFormError('Enter a field when “Field: Other” is selected.');
      return;
    }

    const payload = buildPayload(form);

    setSaving(true);
    try {
      if (formMode === "create") {
        const res = await fetch("/api/interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Create failed (${res.status})`);
      } else if (formMode === "edit" && editingId) {
        const res = await fetch(`/api/interviews/${editingId}`, {
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

  async function removeInterview(i: Interview) {
    const label = i.company.trim() || i.profileName;
    if (!window.confirm(`Remove this interview (${label})? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/interviews/${i.id}`, { method: "DELETE" });
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
            placeholder="Search by profile, company, type, note, or JD…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search interviews"
          />
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" aria-hidden />
          Add interview
        </Button>
      </div>

      <div className="rounded-md border border-border/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="hidden sm:table-cell">Profile</TableHead>
              <TableHead className="hidden md:table-cell">Company</TableHead>
              <TableHead className="hidden lg:table-cell">Type</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="hidden xl:table-cell">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </span>
                </TableCell>
              </TableRow>
            ) : interviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No interviews yet. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              interviews.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap font-medium">{row.interviewDate}</TableCell>
                  <TableCell className="hidden max-w-[10rem] truncate sm:table-cell">{row.profileName}</TableCell>
                  <TableCell className="hidden max-w-[10rem] truncate text-muted-foreground md:table-cell">
                    {row.company || "—"}
                  </TableCell>
                  <TableCell className="hidden max-w-[8rem] truncate lg:table-cell">{row.interviewType || "—"}</TableCell>
                  <TableCell>
                    {row.result ? <Badge variant="secondary">{row.result}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {row.passStatus ? (
                      <Badge variant="outline">{row.passStatus}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => openView(row)} aria-label="View details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Edit interview">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeInterview(row)}
                        aria-label="Delete interview"
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
          <h2 className="text-lg font-semibold">{formMode === "edit" ? "Edit interview" : "New interview"}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={closeForm} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form className="space-y-4" onSubmit={submitForm}>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="int-profile">Profile</Label>
              <select
                id="int-profile"
                className={selectClass}
                required
                value={form.profileId}
                onChange={(e) => setForm((f) => ({ ...f, profileId: e.target.value }))}
              >
                <option value="">Select a profile…</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {profiles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Add profiles first under Profiles.</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="int-date">Interview date</Label>
              <Input
                id="int-date"
                type="date"
                required
                value={form.interviewDate}
                onChange={(e) => setForm((f) => ({ ...f, interviewDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="int-applied">Applied date</Label>
              <Input
                id="int-applied"
                type="date"
                value={form.appliedDate}
                onChange={(e) => setForm((f) => ({ ...f, appliedDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="int-booked">Booked date</Label>
              <Input id="int-booked" type="date" value={form.bookedDate} onChange={(e) => setForm((f) => ({ ...f, bookedDate: e.target.value }))} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="int-type">Type</Label>
              <select
                id="int-type"
                className={selectClass}
                value={form.typePreset}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    typePreset: e.target.value,
                    typeOther: e.target.value === OTHER_OPTION ? f.typeOther : "",
                  }))
                }
              >
                {INTERVIEW_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {form.typePreset === OTHER_OPTION ? (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="int-type-other" className="text-xs text-muted-foreground">
                    Specify type
                  </Label>
                  <Input
                    id="int-type-other"
                    placeholder="e.g. Follow-up screening"
                    value={form.typeOther}
                    onChange={(e) => setForm((f) => ({ ...f, typeOther: e.target.value }))}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="int-result">Result</Label>
              <select
                id="int-result"
                className={selectClass}
                value={form.result}
                onChange={(e) => setForm((f) => ({ ...f, result: e.target.value as FormState["result"] }))}
              >
                {interviewResultValues.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="int-pass">Status</Label>
              <select
                id="int-pass"
                className={selectClass}
                value={form.passStatus}
                onChange={(e) => setForm((f) => ({ ...f, passStatus: e.target.value as FormState["passStatus"] }))}
              >
                {interviewPassStatusValues.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="int-stage">Stage</Label>
              <select
                id="int-stage"
                className={selectClass}
                value={form.stage}
                onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as FormState["stage"] }))}
              >
                {interviewStageValues.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="int-where">Where</Label>
              <select
                id="int-where"
                className={selectClass}
                value={form.wherePreset}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    wherePreset: e.target.value,
                    whereOther: e.target.value === OTHER_OPTION ? f.whereOther : "",
                  }))
                }
              >
                {MEETING_WHERE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {form.wherePreset === OTHER_OPTION ? (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="int-where-other" className="text-xs text-muted-foreground">
                    Specify where
                  </Label>
                  <Input
                    id="int-where-other"
                    placeholder="e.g. In person — office address"
                    value={form.whereOther}
                    onChange={(e) => setForm((f) => ({ ...f, whereOther: e.target.value }))}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="int-field">Field</Label>
              <select
                id="int-field"
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
                {PRACTICE_FIELD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {form.fieldPreset === OTHER_OPTION ? (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="int-field-other" className="text-xs text-muted-foreground">
                    Specify field
                  </Label>
                  <Input
                    id="int-field-other"
                    placeholder="e.g. Data engineering"
                    value={form.fieldOther}
                    onChange={(e) => setForm((f) => ({ ...f, fieldOther: e.target.value }))}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="int-company">Company</Label>
              <Input
                id="int-company"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="int-resume">Resume</Label>
              <textarea
                id="int-resume"
                className={textareaClass}
                placeholder="Link, version, or notes"
                value={form.resume}
                onChange={(e) => setForm((f) => ({ ...f, resume: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="int-jd">JD</Label>
              <textarea
                id="int-jd"
                className={textareaClass}
                placeholder="Job description text or link"
                value={form.jd}
                onChange={(e) => setForm((f) => ({ ...f, jd: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="int-note">Note</Label>
              <textarea
                id="int-note"
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
                "Create interview"
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
                <h2 className="text-lg font-semibold">{viewing.company.trim() || viewing.profileName}</h2>
                <p className="text-sm text-muted-foreground">
                  {viewing.interviewDate} · {viewing.profileName}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeView} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Interview date</dt>
                  <dd>{viewing.interviewDate}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Applied date</dt>
                  <dd>{viewing.appliedDate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Booked date</dt>
                  <dd>{viewing.bookedDate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</dt>
                  <dd>{viewing.interviewType || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Result</dt>
                  <dd>
                    {viewing.result ? <Badge variant="secondary">{viewing.result}</Badge> : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</dt>
                  <dd>
                    {viewing.passStatus ? <Badge variant="outline">{viewing.passStatus}</Badge> : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stage</dt>
                  <dd>{viewing.stage || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Where</dt>
                  <dd>{viewing.meetingWhere || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Field</dt>
                  <dd>{viewing.practiceField || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</dt>
                  <dd>{viewing.company || "—"}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resume</dt>
                <dd className="whitespace-pre-wrap">{viewing.resume || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">JD</dt>
                <dd className="whitespace-pre-wrap">{viewing.jd || "—"}</dd>
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
              <Button type="button" variant="destructive" className="gap-2" onClick={() => removeInterview(viewing)}>
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
