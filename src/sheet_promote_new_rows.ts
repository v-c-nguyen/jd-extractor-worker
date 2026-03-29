import { INVALID_JOB_URL_MSG, isValidJobUrl } from "./job_url_util.js";

export type SheetValueBatchEntry = {
  range: string;
  values: (string | number)[][];
};

/**
 * Rows with non-empty job_url and empty status: set status "new" and clear error if URL is valid;
 * if URL is invalid, set error_message (once per message change) so the row is not silently skipped.
 */
export function buildPromoteEmptyJobUrlBatch(
  grid: (string | number | boolean | undefined)[][],
  sheetTab: string,
  jobUrlIdx: number,
  statusIdx: number,
  errorMessageIdx: number,
  colLetter: (index: number) => string
): { updates: SheetValueBatchEntry[]; promotedRowNums: Set<number> } {
  const updates: SheetValueBatchEntry[] = [];
  const promotedRowNums = new Set<number>();
  const sCol = colLetter(statusIdx);
  const eCol = colLetter(errorMessageIdx);

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const jobUrl = row[jobUrlIdx];
    const status = row[statusIdx];
    const urlTrim =
      jobUrl !== undefined && jobUrl !== null ? String(jobUrl).trim() : "";
    const statusTrim = String(status ?? "").trim();
    if (!urlTrim || statusTrim !== "") continue;

    const sheetRowNum = i + 1;

    if (isValidJobUrl(urlTrim)) {
      promotedRowNums.add(sheetRowNum);
      updates.push(
        { range: `${sheetTab}!${sCol}${sheetRowNum}`, values: [["new"]] },
        { range: `${sheetTab}!${eCol}${sheetRowNum}`, values: [[""]] }
      );
    } else {
      const existingErr = String(row[errorMessageIdx] ?? "").trim();
      if (existingErr !== INVALID_JOB_URL_MSG) {
        updates.push({
          range: `${sheetTab}!${eCol}${sheetRowNum}`,
          values: [[INVALID_JOB_URL_MSG]],
        });
      }
    }
  }

  return { updates, promotedRowNums };
}
