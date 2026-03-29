import { getProfileById } from "@/lib/profiles/repo";

export async function validateProfilesForBidder(
  bidderId: string,
  profileIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const seen = new Set<string>();
  for (const id of profileIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const p = await getProfileById(id);
    if (!p) return { ok: false, message: "Unknown profile." };
    if (p.bidderId !== bidderId) {
      return { ok: false, message: "Profile is not assigned to this bidder." };
    }
  }
  return { ok: true };
}
