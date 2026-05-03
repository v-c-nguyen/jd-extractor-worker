"use client";

import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Profile, ProfileAttachmentMeta } from "@/lib/profiles/types";
import type { Bidder } from "@/lib/bidders/types";
import { dispatchInterviewSchedulingChanged } from "@/lib/interview-scheduling-events";
import { formatDobForDisplay } from "@/lib/profiles/format-dob";
import {
  Briefcase,
  Building2,
  Calendar,
  FileText,
  IdCard,
  ImagePlus,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Search,
  Shield,
  StickyNote,
  Tag,
  Trash2,
  UserCircle,
  Eye,
  X,
} from "lucide-react";

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

function FormSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-gradient-to-b from-muted/35 to-transparent p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex gap-3 border-b border-border/50 pb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm ring-1 ring-border/60">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function ViewField({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-gradient-to-br from-muted/25 to-transparent p-3.5 shadow-sm sm:p-4",
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
        {label}
      </div>
      <div className="text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

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
  dateOfBirth: string;
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
  ssnNumber: string;
  dlNumber: string;
  additionalInformation: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    dateOfBirth: "",
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
    ssnNumber: "",
    dlNumber: "",
    additionalInformation: "",
  };
}

type ProfilesGroupBy = "country" | "field" | "bidder";

const GROUP_UNSPECIFIED = "Unspecified";
const GROUP_NO_BIDDER = "No bidder linked";

function bucketLabel(p: Profile, by: ProfilesGroupBy): string {
  if (by === "country") {
    return p.country?.trim() ? p.country.trim() : GROUP_UNSPECIFIED;
  }
  if (by === "field") {
    return p.field?.trim() ? p.field.trim() : GROUP_UNSPECIFIED;
  }
  return p.bidderName?.trim() ? p.bidderName.trim() : GROUP_NO_BIDDER;
}

function groupProfilesSorted(profiles: Profile[], by: ProfilesGroupBy): { label: string; items: Profile[] }[] {
  const map = new Map<string, Profile[]>();
  for (const p of profiles) {
    const label = bucketLabel(p, by);
    const list = map.get(label);
    if (list) list.push(p);
    else map.set(label, [p]);
  }
  const sortLast = new Set([GROUP_UNSPECIFIED, GROUP_NO_BIDDER]);
  const entries = [...map.entries()].map(([label, items]) => ({
    label,
    items: [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
  }));
  entries.sort((a, b) => {
    const aLast = sortLast.has(a.label) ? 1 : 0;
    const bLast = sortLast.has(b.label) ? 1 : 0;
    if (aLast !== bLast) return aLast - bLast;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
  return entries;
}

function ProfileCard({
  p,
  onView,
  onEdit,
  onRemove,
}: {
  p: Profile;
  onView: (p: Profile) => void;
  onEdit: (p: Profile) => void;
  onRemove: (p: Profile) => void;
}) {
  const dobDisplay = p.dateOfBirth?.trim() ? formatDobForDisplay(p.dateOfBirth) : null;
  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="space-y-3 border-b border-border/50 bg-muted/20 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
            <UserCircle className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <CardTitle className="text-base font-semibold leading-snug tracking-tight">{p.name}</CardTitle>
            <CardDescription className="space-y-1.5 text-sm">
              {dobDisplay ? (
                <span className="flex items-center gap-2 text-foreground/90">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{dobDisplay}</span>
                </span>
              ) : null}
              <span className="flex items-start gap-2 text-muted-foreground">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 leading-snug">
                  {p.bidderName ? <span className="text-foreground/85">{p.bidderName}</span> : "No bidder linked"}
                </span>
              </span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3.5 pt-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          {p.status ? (
            <Badge variant="secondary" className="font-normal">
              {p.status}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <dl className="grid gap-3 text-muted-foreground">
          <div className="flex gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/80" aria-hidden />
            <div className="min-w-0 flex-1">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/90">Country</dt>
              <dd className="mt-0.5 font-medium text-foreground">{p.country || "—"}</dd>
            </div>
          </div>
          <div className="flex gap-2.5">
            <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/80" aria-hidden />
            <div className="min-w-0 flex-1">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/90">Field</dt>
              <dd className="mt-0.5 font-medium text-foreground">{p.field || "—"}</dd>
            </div>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap justify-end gap-1 border-t border-border/60 bg-muted/10 pt-4">
        <Button type="button" variant="ghost" size="icon" onClick={() => onView(p)} aria-label="View details">
          <Eye className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(p)} aria-label="Edit profile">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={() => onRemove(p)}
          aria-label="Delete profile"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function profileToForm(p: Profile): FormState {
  const c = splitPresetOther(p.country, PROFILE_COUNTRY_OPTIONS);
  const st = splitPresetOther(p.status, PROFILE_STATUS_OPTIONS);
  const fi = splitPresetOther(p.field, PROFILE_FIELD_OPTIONS);
  return {
    name: p.name,
    dateOfBirth: p.dateOfBirth?.trim() ?? "",
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
    ssnNumber: p.ssnNumber ?? "",
    dlNumber: p.dlNumber ?? "",
    additionalInformation: p.additionalInformation ?? "",
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
  const [viewLoading, setViewLoading] = useState(false);
  const [groupBy, setGroupBy] = useState<ProfilesGroupBy>("country");
  const [attachmentMetaOnEdit, setAttachmentMetaOnEdit] = useState<ProfileAttachmentMeta[]>([]);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);

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

  const groupedProfiles = useMemo(() => groupProfilesSorted(profiles, groupBy), [profiles, groupBy]);

  function openCreate() {
    setFormMode("create");
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setAttachmentMetaOnEdit([]);
    setPendingImageFiles([]);
    formRef.current?.showModal();
  }

  async function openEdit(p: Profile) {
    setFormError(null);
    setAttachmentMetaOnEdit([]);
    setPendingImageFiles([]);
    try {
      const res = await fetch(`/api/profiles/${p.id}`);
      const data = (await res.json().catch(() => ({}))) as Profile & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Failed to load profile (${res.status})`);
      }
      setFormMode("edit");
      setEditingId(data.id);
      setForm(profileToForm(data));
      setAttachmentMetaOnEdit(data.attachments ?? []);
      formRef.current?.showModal();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to open profile");
    }
  }

  async function openView(p: Profile) {
    setViewLoading(true);
    setViewing(null);
    viewRef.current?.showModal();
    try {
      const res = await fetch(`/api/profiles/${p.id}`);
      const data = (await res.json().catch(() => ({}))) as Profile & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Failed to load profile (${res.status})`);
      }
      setViewing(data);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to load profile");
      viewRef.current?.close();
    } finally {
      setViewLoading(false);
    }
  }

  function closeForm() {
    formRef.current?.close();
    setFormMode(null);
    setEditingId(null);
    setFormError(null);
    setAttachmentMetaOnEdit([]);
    setPendingImageFiles([]);
  }

  function closeView() {
    viewRef.current?.close();
    setViewing(null);
    setViewLoading(false);
  }

  async function uploadPendingImages(profileId: string, files: File[]): Promise<void> {
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/profiles/${profileId}/attachments`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }
    }
  }

  function onPickAdditionalImages(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    setPendingImageFiles((prev) => {
      const next = [...prev, ...picked];
      return next.slice(0, 12);
    });
  }

  function removePendingImageAt(index: number) {
    setPendingImageFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function removeExistingAttachment(attachmentId: string) {
    if (!editingId) return;
    if (!window.confirm("Remove this image?")) return;
    try {
      const res = await fetch(`/api/profiles/${editingId}/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Remove failed (${res.status})`);
      }
      setAttachmentMetaOnEdit((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Remove failed");
    }
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
      dateOfBirth: form.dateOfBirth.trim(),
      ssnNumber: form.ssnNumber.trim(),
      dlNumber: form.dlNumber.trim(),
      additionalInformation: form.additionalInformation.trim(),
      emails: trimmedEmails.map((row) => ({
        ...(row.label ? { label: row.label } : {}),
        value: row.value,
      })),
    };

    const bidder = form.bidderId.trim();
    payload.bidderId = bidder.length > 0 ? bidder : null;

    setSaving(true);
    try {
      let savedProfileId: string | null = null;
      if (formMode === "create") {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as Profile & { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Create failed (${res.status})`);
        savedProfileId = data.id;
      } else if (formMode === "edit" && editingId) {
        const res = await fetch(`/api/profiles/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as Profile & { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Update failed (${res.status})`);
        savedProfileId = data.id ?? editingId;
      }

      if (savedProfileId && pendingImageFiles.length > 0) {
        try {
          await uploadPendingImages(savedProfileId, pendingImageFiles);
          setPendingImageFiles([]);
        } catch (uploadErr) {
          setFormError(
            uploadErr instanceof Error
              ? `${uploadErr.message} (profile was saved; you can add images again from Edit.)`
              : "Image upload failed (profile was saved)."
          );
          if (formMode === "create") {
            setFormMode("edit");
            setEditingId(savedProfileId);
            const reload = await fetch(`/api/profiles/${savedProfileId}`);
            const full = (await reload.json()) as Profile;
            if (reload.ok) {
              setForm(profileToForm(full));
              setAttachmentMetaOnEdit(full.attachments ?? []);
            }
          } else {
            const reload = await fetch(`/api/profiles/${savedProfileId}`);
            const full = (await reload.json()) as Profile;
            if (reload.ok) {
              setAttachmentMetaOnEdit(full.attachments ?? []);
            }
          }
          await load();
          dispatchInterviewSchedulingChanged();
          setSaving(false);
          return;
        }
      }

      closeForm();
      await load();
      dispatchInterviewSchedulingChanged();
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
      dispatchInterviewSchedulingChanged();
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search by name, DOB, country, status, field, bidder…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search profiles"
            />
          </div>
          {!loading && profiles.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span id="profiles-group-label" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                View by
              </span>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-labelledby="profiles-group-label"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={groupBy === "country" ? "default" : "outline"}
                  onClick={() => setGroupBy("country")}
                >
                  Country
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={groupBy === "field" ? "default" : "outline"}
                  onClick={() => setGroupBy("field")}
                >
                  Field
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={groupBy === "bidder" ? "default" : "outline"}
                  onClick={() => setGroupBy("bidder")}
                >
                  Bidder
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0 gap-2 self-start">
          <Plus className="h-4 w-4" aria-hidden />
          Add profile
        </Button>
      </div>

      {loading ? (
        <Card className="border-border/80">
          <CardContent className="flex min-h-[10rem] items-center justify-center py-10 text-muted-foreground">
            <span className="inline-flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading profiles…
            </span>
          </CardContent>
        </Card>
      ) : profiles.length === 0 ? (
        <Card className="border-border/80">
          <CardContent className="flex min-h-[10rem] items-center justify-center py-10 text-center text-sm text-muted-foreground">
            No profiles yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {groupedProfiles.map(({ label, items }, groupIndex) => (
            <section
              key={label}
              className="space-y-4"
              aria-labelledby={`profile-group-heading-${groupIndex}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border/60 pb-2">
                <h2
                  id={`profile-group-heading-${groupIndex}`}
                  className="text-base font-semibold tracking-tight text-foreground"
                >
                  {label}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {items.length} {items.length === 1 ? "profile" : "profiles"}
                </span>
              </div>
              <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3" role="list">
                {items.map((p) => (
                  <li key={p.id}>
                    <ProfileCard p={p} onView={openView} onEdit={openEdit} onRemove={removeProfile} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <dialog ref={formRef} className={dialogClass} onClose={() => setFormMode(null)}>
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-border/50 pb-4">
          <div className="min-w-0 space-y-1 pr-2">
            <h2 className="text-lg font-semibold tracking-tight">
              {formMode === "edit" ? "Edit profile" : "New profile"}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Grouped fields for faster scanning. Name is required. Sensitive identifiers are administrator-only.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={closeForm} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form className="space-y-6" onSubmit={submitForm} autoComplete="off">
          {formError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/[0.07] px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <div className="space-y-6">
            <FormSection
              title="Identity"
              description="Legal name and date of birth for personnel records."
              icon={UserCircle}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="prof-name" className="inline-flex items-center gap-2 text-foreground">
                  <UserCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  Full name
                </Label>
                <Input
                  id="prof-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="max-w-xl"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="prof-dob" className="inline-flex items-center gap-2 text-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  Date of birth
                </Label>
                <Input
                  id="prof-dob"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  className="max-w-[12rem] bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Displayed on roster cards and in the profile view as a full calendar date (UTC).
                </p>
              </div>
            </FormSection>

            <FormSection
              title="Role & placement"
              description="Region, status, discipline, and optional bidder assignment."
              icon={Briefcase}
            >
            <div className="space-y-2">
              <Label htmlFor="prof-country" className="inline-flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Country
              </Label>
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
              <Label htmlFor="prof-status" className="inline-flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Status
              </Label>
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
              <Label htmlFor="prof-field" className="inline-flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Field
              </Label>
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
              <Label htmlFor="prof-bidder" className="inline-flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Bidder (registered)
              </Label>
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
            </FormSection>

            <FormSection
              title="Online presence"
              description="Professional profiles and public code links."
              icon={Link2}
            >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-linkedin" className="inline-flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                LinkedIn
              </Label>
              <Input
                id="prof-linkedin"
                placeholder="URL or handle"
                value={form.linkedin}
                onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-github" className="inline-flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                GitHub
              </Label>
              <Input
                id="prof-github"
                placeholder="URL or username"
                value={form.github}
                onChange={(e) => setForm((f) => ({ ...f, github: e.target.value }))}
              />
            </div>
            </FormSection>

            <FormSection
              title="Contact"
              description="Email addresses and physical mailing address."
              icon={Mail}
            >
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  Emails
                </Label>
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
              <Label htmlFor="prof-address" className="inline-flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Address
              </Label>
              <textarea
                id="prof-address"
                className={textareaClass}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                rows={2}
              />
            </div>
            </FormSection>

            <FormSection
              title="Government identifiers"
              description="Highly sensitive — limit access outside this application."
              icon={Shield}
            >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-ssn" className="inline-flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                SSN number
              </Label>
              <Input
                id="prof-ssn"
                name="ssn"
                autoComplete="off"
                inputMode="numeric"
                placeholder="e.g. last 4 or full as required"
                value={form.ssnNumber}
                onChange={(e) => setForm((f) => ({ ...f, ssnNumber: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Stored in the database; visible to administrators only.</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-dl" className="inline-flex items-center gap-2">
                <IdCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Driver license number
              </Label>
              <Input
                id="prof-dl"
                name="dl"
                autoComplete="off"
                placeholder="DL / ID number"
                value={form.dlNumber}
                onChange={(e) => setForm((f) => ({ ...f, dlNumber: e.target.value }))}
              />
            </div>
            </FormSection>

            <FormSection
              title="Documents & notes"
              description="Supporting narrative, images, and internal notes."
              icon={FileText}
            >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-additional" className="inline-flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Additional information
              </Label>
              <textarea
                id="prof-additional"
                className={textareaClass}
                placeholder="Other details, references, context…"
                value={form.additionalInformation}
                onChange={(e) => setForm((f) => ({ ...f, additionalInformation: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="space-y-3 sm:col-span-2">
              <Label className="inline-flex items-center gap-2">
                <ImagePlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Images
              </Label>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, WebP, or GIF — up to 5 MB each, 20 per profile. Images upload when you save the profile (or
                retry from Edit if upload fails).
              </p>
              {formMode === "edit" && attachmentMetaOnEdit.length > 0 ? (
                <ul className="flex flex-wrap gap-3">
                  {attachmentMetaOnEdit.map((a) => (
                    <li key={a.id} className="relative w-28 shrink-0">
                      <img
                        src={`/api/profiles/${editingId}/attachments/${a.id}`}
                        alt=""
                        className="h-24 w-full rounded-md border border-border object-cover"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-1 w-full text-xs"
                        onClick={() => removeExistingAttachment(a.id)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
                  <label className="cursor-pointer">
                    <ImagePlus className="h-4 w-4" aria-hidden />
                    Add images
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="sr-only"
                      onChange={onPickAdditionalImages}
                    />
                  </label>
                </Button>
              </div>
              {pendingImageFiles.length > 0 ? (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {pendingImageFiles.map((file, i) => (
                    <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 rounded border border-border/60 px-2 py-1">
                      <span className="min-w-0 truncate">{file.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removePendingImageAt(i)}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-note" className="inline-flex items-center gap-2">
                <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Note
              </Label>
              <textarea
                id="prof-note"
                className={textareaClass}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={3}
              />
            </div>
            </FormSection>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
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

      <dialog ref={viewRef} className={dialogClass} onClose={() => { setViewing(null); setViewLoading(false); }}>
        {viewLoading ? (
          <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            <p className="text-sm">Loading profile…</p>
          </div>
        ) : viewing ? (
          <>
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-border/50 pb-5">
              <div className="flex min-w-0 flex-1 gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <UserCircle className="h-8 w-8" aria-hidden />
                </div>
                <div className="min-w-0 space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">{viewing.name}</h2>
                  {viewing.dateOfBirth?.trim() ? (
                    <p className="inline-flex w-fit items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-sm font-medium text-foreground ring-1 ring-border/70">
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      {formatDobForDisplay(viewing.dateOfBirth)}
                    </p>
                  ) : null}
                  <p className="text-xs font-medium text-muted-foreground">Administrator view · confidential record</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={closeView} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ViewField icon={MapPin} label="Country">
                {viewing.country || "—"}
              </ViewField>
              <ViewField icon={Tag} label="Status">
                {viewing.status ? <Badge variant="secondary" className="font-normal">{viewing.status}</Badge> : "—"}
              </ViewField>
              <ViewField icon={Briefcase} label="Field">
                {viewing.field || "—"}
              </ViewField>
              <ViewField icon={Building2} label="Bidder">
                {viewing.bidderName ?? "—"}
              </ViewField>
              <ViewField icon={Link2} label="LinkedIn">
                <span className="break-all">{viewing.linkedin || "—"}</span>
              </ViewField>
              <ViewField icon={Link2} label="GitHub">
                <span className="break-all">{viewing.github || "—"}</span>
              </ViewField>
              <ViewField icon={Mail} label="Emails" className="sm:col-span-2">
                {viewing.emails.length === 0 ? (
                  "—"
                ) : (
                  <ul className="space-y-1.5">
                    {viewing.emails.map((e) => (
                      <li key={e.id}>
                        {e.label ? <span className="text-muted-foreground">{e.label}: </span> : null}
                        <span>{e.value}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </ViewField>
              <ViewField icon={MapPin} label="Address" className="sm:col-span-2">
                <span className="whitespace-pre-wrap">{viewing.address || "—"}</span>
              </ViewField>
              <ViewField icon={Shield} label="SSN number">
                <span className="font-mono tabular-nums">{viewing.ssnNumber?.trim() ? viewing.ssnNumber : "—"}</span>
              </ViewField>
              <ViewField icon={IdCard} label="Driver license number">
                <span className="font-mono tabular-nums">{viewing.dlNumber?.trim() ? viewing.dlNumber : "—"}</span>
              </ViewField>
            </div>

            {viewing.additionalInformation?.trim() ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ViewField icon={FileText} label="Additional information" className="sm:col-span-2">
                  <span className="whitespace-pre-wrap">{viewing.additionalInformation}</span>
                </ViewField>
              </div>
            ) : null}

            {viewing.attachments && viewing.attachments.length > 0 ? (
              <div className="mt-4 rounded-xl border border-border/60 bg-muted/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                  Images
                </div>
                <ul className="flex flex-wrap gap-4">
                  {viewing.attachments.map((a) => (
                    <li key={a.id} className="w-[8.5rem] shrink-0">
                      <a
                        href={`/api/profiles/${viewing.id}/attachments/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded-lg ring-offset-2 transition hover:ring-2 hover:ring-primary/30"
                      >
                        <img
                          src={`/api/profiles/${viewing.id}/attachments/${a.id}`}
                          alt={a.originalName}
                          className="h-28 w-full rounded-lg border border-border object-cover shadow-sm"
                        />
                        <span className="mt-1.5 line-clamp-2 block text-xs font-medium text-primary underline-offset-2 group-hover:underline">
                          {a.originalName}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {viewing.note ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ViewField icon={StickyNote} label="Note" className="sm:col-span-2">
                  <span className="whitespace-pre-wrap">{viewing.note}</span>
                </ViewField>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-2 border-t border-border/50 pt-5">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const v = viewing;
                  closeView();
                  void openEdit(v);
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
