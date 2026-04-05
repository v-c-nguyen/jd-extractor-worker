/** Past calendar dates (UTC) still marked Booked need a terminal result. */

export type StaleBookedInterviewSummary = {
  id: string;
  profileName: string;
  interviewDate: string;
  company: string;
};

export function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isStaleBookedInterview(interviewDateYmd: string, result: string): boolean {
  if (result.trim().toLowerCase() !== "booked") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(interviewDateYmd)) return false;
  return interviewDateYmd < todayYmdUtc();
}
