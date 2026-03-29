/** Shown in error_message when job_url is non-empty but not a valid http(s) URL. */
export const INVALID_JOB_URL_MSG =
  "Invalid job_url: use a full http(s) URL (e.g. https://...)";

/** True if the string parses as a URL with http: or https: scheme. */
export function isValidJobUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
