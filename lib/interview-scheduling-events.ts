export const INTERVIEW_SCHEDULING_CHANGED_EVENT = "interview-scheduling-changed";

export function dispatchInterviewSchedulingChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INTERVIEW_SCHEDULING_CHANGED_EVENT));
}
