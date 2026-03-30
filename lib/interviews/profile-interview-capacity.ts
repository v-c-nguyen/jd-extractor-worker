import { getProfileById } from "@/lib/profiles/repo";
import { countInterviewsForProfile, sumWorkInterviewCountForProfile } from "@/lib/interviews/repo";

export async function validateNewInterviewForProfile(profileId: string): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const profile = await getProfileById(profileId);
  if (!profile) {
    return { ok: false, message: "Profile not found." };
  }
  const target = await sumWorkInterviewCountForProfile(profileId);
  if (target <= 0) {
    return {
      ok: false,
      message:
        "This profile has no interview total in the daily work log yet. Enter interview counts per day for this profile (bidder work or your daily work) before adding interview details.",
    };
  }
  const entered = await countInterviewsForProfile(profileId);
  if (entered >= target) {
    return {
      ok: false,
      message: `This profile already has ${entered} interview detail record(s), matching the work log total (${target}).`,
    };
  }
  return { ok: true };
}

/** When reassigning an interview to another profile, the target must have spare capacity vs work-log sum. */
export async function validateInterviewProfileReassignment(
  fromProfileId: string,
  toProfileId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (fromProfileId === toProfileId) {
    return { ok: true };
  }
  const profile = await getProfileById(toProfileId);
  if (!profile) {
    return { ok: false, message: "Profile not found." };
  }
  const target = await sumWorkInterviewCountForProfile(toProfileId);
  if (target <= 0) {
    return {
      ok: false,
      message:
        "The selected profile has no interview total in the daily work log. Log interview counts for that profile first.",
    };
  }
  const onTarget = await countInterviewsForProfile(toProfileId);
  if (onTarget >= target) {
    return {
      ok: false,
      message: "That profile already has enough interview details for its work-log interview total.",
    };
  }
  return { ok: true };
}
