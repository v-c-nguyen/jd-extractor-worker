export const INTERVIEW_SCHEDULING_CHANGED_EVENT = "interview-scheduling-changed";

/** Emitted after /api/interviews/scheduling-status is loaded (for nav badges). */
export const INTERVIEW_ALERT_COUNTS_EVENT = "interview-alert-counts";

export type InterviewAlertCountsDetail = {
  staleBooked: number;
  openSlots: number;
};

export function dispatchInterviewSchedulingChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INTERVIEW_SCHEDULING_CHANGED_EVENT));
}

export function dispatchInterviewAlertCounts(detail: InterviewAlertCountsDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INTERVIEW_ALERT_COUNTS_EVENT, { detail }));
}
