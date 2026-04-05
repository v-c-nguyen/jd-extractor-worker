import { getProfileById } from "@/lib/profiles/repo";
import {
  countInterviewsForProfile,
  listAllWorkInterviewAggregates,
  listProfileInterviewCapacities,
} from "@/lib/interviews/repo";

export type OpenInterviewSlot = {
  profileId: string;
  profileName: string;
  /** 0-based index in FIFO slot list (work-log days ascending); required on create. */
  workLogSlotIndex: number;
  /** Work log date (YYYY-MM-DD) that this slot comes from. */
  scheduledDate: string;
};

export type WorkInterviewDayAggregate = { workDate: string; count: number };

/** One slot per interview unit logged on that calendar day (after summing all bidders for the profile). */
export function expandAggregatesToSlotDates(rows: WorkInterviewDayAggregate[]): string[] {
  const dates: string[] = [];
  for (const r of rows) {
    for (let k = 0; k < r.count; k++) {
      dates.push(r.workDate);
    }
  }
  return dates;
}

function groupAggregatesByProfile(
  rows: { profileId: string; workDate: string; count: number }[]
): Map<string, WorkInterviewDayAggregate[]> {
  const m = new Map<string, WorkInterviewDayAggregate[]>();
  for (const r of rows) {
    const list = m.get(r.profileId) ?? [];
    list.push({ workDate: r.workDate, count: r.count });
    m.set(r.profileId, list);
  }
  return m;
}

/** Every profile/detail row still missing vs work-log totals, with scheduled date from bidder work entries. */
export async function listOpenInterviewSlots(): Promise<OpenInterviewSlot[]> {
  const [capacities, aggregates] = await Promise.all([
    listProfileInterviewCapacities(),
    listAllWorkInterviewAggregates(),
  ]);
  const byProfile = groupAggregatesByProfile(aggregates);
  const open: OpenInterviewSlot[] = [];

  for (const cap of capacities) {
    if (cap.scheduledCount <= cap.enteredCount) continue;
    const rows = byProfile.get(cap.profileId) ?? [];
    const slotDates = expandAggregatesToSlotDates(rows);
    const entered = cap.enteredCount;
    for (let i = entered; i < slotDates.length; i++) {
      open.push({
        profileId: cap.profileId,
        profileName: cap.profileName,
        workLogSlotIndex: i,
        scheduledDate: slotDates[i] ?? "",
      });
    }
  }

  open.sort((a, b) => {
    const d = a.scheduledDate.localeCompare(b.scheduledDate);
    if (d !== 0) return d;
    const n = a.profileName.localeCompare(b.profileName, undefined, { sensitivity: "base" });
    if (n !== 0) return n;
    return a.workLogSlotIndex - b.workLogSlotIndex;
  });
  return open;
}

export function encodeWorkLogSlotKey(profileId: string, workLogSlotIndex: number): string {
  return `${profileId}|${workLogSlotIndex}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseWorkLogSlotKey(key: string): { profileId: string; workLogSlotIndex: number } | null {
  const s = key.trim();
  const last = s.lastIndexOf("|");
  if (last <= 0 || last === s.length - 1) return null;
  const profileId = s.slice(0, last).trim();
  const idx = Number.parseInt(s.slice(last + 1), 10);
  if (!UUID_RE.test(profileId) || !Number.isFinite(idx) || idx < 0) return null;
  return { profileId, workLogSlotIndex: idx };
}

export function formatScheduledDateLabel(isoYmd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoYmd)) return isoYmd;
  const d = new Date(`${isoYmd}T12:00:00`);
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export type OpenSlotWithOrdinal = OpenInterviewSlot & { ordinalInGroup: number; groupSize: number };

export function attachOpenSlotOrdinals(slots: OpenInterviewSlot[]): OpenSlotWithOrdinal[] {
  const groupSize = new Map<string, number>();
  for (const s of slots) {
    const k = `${s.profileId}\0${s.scheduledDate}`;
    groupSize.set(k, (groupSize.get(k) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return slots.map((s) => {
    const k = `${s.profileId}\0${s.scheduledDate}`;
    const total = groupSize.get(k) ?? 1;
    const ord = (seen.get(k) ?? 0) + 1;
    seen.set(k, ord);
    return { ...s, ordinalInGroup: ord, groupSize: total };
  });
}

export async function validateWorkLogSlotForNewInterview(
  profileId: string,
  workLogSlotIndex: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const profile = await getProfileById(profileId);
  if (!profile) {
    return { ok: false, message: "Profile not found." };
  }
  const aggregates = await listAllWorkInterviewAggregates();
  const rows = aggregates
    .filter((r) => r.profileId === profileId)
    .map((r) => ({ workDate: r.workDate, count: r.count }));
  const slotDates = expandAggregatesToSlotDates(rows);
  const entered = await countInterviewsForProfile(profileId);
  if (slotDates.length === 0) {
    return {
      ok: false,
      message:
        "This profile has no interview total in the daily work log yet. Log interview counts per day for this profile before adding interview details.",
    };
  }
  if (workLogSlotIndex < entered || workLogSlotIndex >= slotDates.length) {
    return {
      ok: false,
      message:
        "This work-log interview slot is no longer available (counts may have changed or details already added). Refresh and pick an open slot.",
    };
  }
  return { ok: true };
}
