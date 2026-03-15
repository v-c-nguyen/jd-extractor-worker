export const MAX_CHARS = 25_000;

const SURVEY_MARKERS = [
  "for government reporting purposes",
  "form cc-305",
  "omb control number",
  "veteran status",
  "disability status",
];

/**
 * Remove EEO/survey content that may have slipped through DOM pruning.
 */
function stripSurveyContent(text: string): string {
  const lower = text.toLowerCase();
  let cutIndex = -1;

  for (const marker of SURVEY_MARKERS) {
    const idx = lower.indexOf(marker);
    if (idx !== -1 && (cutIndex === -1 || idx < cutIndex)) {
      cutIndex = idx;
    }
  }

  if (cutIndex !== -1) {
    return text.slice(0, cutIndex);
  }
  return text;
}

/**
 * Collapse multiple blank lines to at most two newlines, trim, and cap length.
 */
export function normalizeText(text: string): string {
  const stripped = stripSurveyContent(text);
  const collapsed = stripped
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (collapsed.length <= MAX_CHARS) return collapsed;
  return collapsed.slice(0, MAX_CHARS);
}
