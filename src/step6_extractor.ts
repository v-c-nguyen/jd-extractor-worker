import "dotenv/config";
import { google } from "googleapis";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { add as dedupAdd, has as dedupHas } from "./dedup/hash_store.js";
import { extractJobFields } from "./extract/openai_extract.js";
import {
  extractWithRules,
  mergeRuleIntoExtraction,
} from "./extract/rule_extractor.js";
import type { JobExtraction } from "./extract/schema.js";
import {
  validateExtraction,
  type ValidateExtractionInput,
} from "./extract/validate_extraction.js";

const POLL_INTERVAL_MS = 30_000;
const MAX_BATCH = 3;
const DATA_RANGE = "A:Z";
const ERROR_MESSAGE_MAX_LEN = 200;
const CACHE_DIR = "cache";
/** Rows stuck in extracting_in_progress longer than this are re-picked (recovery from crash). */
const EXTRACT_CLAIM_STALE_MS = 5 * 60 * 1000;

function indexToColumnLetter(index: number): string {
  let colNum = index + 1;
  let s = "";
  while (colNum > 0) {
    s = String.fromCharCode(65 + ((colNum - 1) % 26)) + s;
    colNum = Math.floor((colNum - 1) / 26);
  }
  return s;
}

function getHeaderIndexOrThrow(
  headerRow: (string | number | boolean | undefined)[],
  name: string
): number {
  const idx = headerRow.findIndex(
    (h) => String(h ?? "").trim().toLowerCase() === name.toLowerCase()
  );
  if (idx === -1) {
    throw new Error(`Required column '${name}' not found in header`);
  }
  return idx;
}

function truncateError(msg: string): string {
  if (msg.length <= ERROR_MESSAGE_MAX_LEN) return msg;
  return msg.slice(0, ERROR_MESSAGE_MAX_LEN - 3) + "...";
}

function valueToSheet(val: string | number | null): string | number {
  if (val === null) return "";
  return val;
}

function buildSalaryJson(extraction: JobExtraction): string {
  const obj: Record<string, string | number> = {};

  if (extraction.salary_min !== null) obj.min = extraction.salary_min;
  if (extraction.salary_max !== null) obj.max = extraction.salary_max;
  if (extraction.salary_period !== "Not mentioned") obj.period = extraction.salary_period;
  if (extraction.currency !== null) obj.currency = extraction.currency;

  if (Object.keys(obj).length === 0) return "";
  return JSON.stringify(obj);
}

function getHeaderIndexOptional(
  headerRow: (string | number | boolean | undefined)[],
  name: string
): number | null {
  const idx = headerRow.findIndex(
    (h) => String(h ?? "").trim().toLowerCase() === name.toLowerCase()
  );
  return idx === -1 ? null : idx;
}

function isClaimStale(lastProcessedAtVal: unknown): boolean {
  const s = String(lastProcessedAtVal ?? "").trim();
  if (!s) return true;
  const t = Date.parse(s);
  return Number.isNaN(t) || Date.now() - t > EXTRACT_CLAIM_STALE_MS;
}

/** Not usable: Staff | Principal | Lead */
const NOT_USABLE_SENIORITY = new Set(["Staff", "Principal", "Lead"]);

/** Exact-match industry buckets (normalized to lowercase). */
const NOT_USABLE_INDUSTRIES = new Set([
  "security (physical/national)",
  "aerospace/defense",
  "government/public sector",
  "energy/utilities",
  "healthcare providers",
  "banking/financial services",
  "insurance",
  "investment/asset mgmt",
  "biotech/pharma",
  "med devices/equipment",
  "healthtech",
  "professional services",
  "fintech",
  "cybersecurity",
]);

function getExtractionStatusForPassedValidation(
  extraction: JobExtraction
): "usable" | "consider" | "not_usable" {
  const seniority = extraction.seniority?.trim();
  if (seniority && NOT_USABLE_SENIORITY.has(seniority)) return "not_usable";

  const workMode = extraction.work_mode?.trim();
  if (workMode === "Hybrid" || workMode === "Onsite") return "not_usable";
  if (workMode === "Not mentioned") return "consider";

  const travelStr = extraction.travel?.trim() ?? "";
  if (travelStr) {
    const match = travelStr.match(/(\d{1,3})\s*%?/);
    if (match) {
      const pct = parseInt(match[1]!, 10);
      if (!Number.isNaN(pct) && pct > 10) return "not_usable";
    }
  }

  if (extraction.location?.trim().toLowerCase() === "no") return "not_usable";

  const industry = extraction.industry?.trim().toLowerCase() ?? "";
  if (industry && NOT_USABLE_INDUSTRIES.has(industry)) return "not_usable";

  if (extraction.clearance_required?.trim().toLowerCase() === "yes")
    return "not_usable";
  if (extraction.government_agency?.trim().toLowerCase() === "yes")
    return "not_usable";

  return "usable";
}

interface ColumnIndices {
  // Required columns
  jobUrl: number;
  status: number;
  rawTextHash: number;
  companyName: number;
  roleTitle: number;
  workMode: number;
  location: number;
  industry: number;
  travel: number;
  clearanceRequired: number;
  governmentAgency: number;
  type: number;
  seniority: number;
  lastProcessedAt: number;
  errorMessage: number;
  // JSON columns (primary output)
  salary: number | null;
  // Legacy optional columns
  salaryMin: number | null;
  salaryMax: number | null;
  currency: number | null;
  salaryPeriod: number | null;
  // Validation optional columns
  validationStatus: number | null;
  lastErrorStage: number | null;
  // Token usage optional column
  tokenUsage: number | null;
}

let warnedMissingValidationStatusCol = false;
let warnedMissingLastErrorStageCol = false;
let warnedMissingTokenUsageCol = false;

function getColumnIndices(
  headerRow: (string | number | boolean | undefined)[]
): ColumnIndices {
  return {
    // Required columns
    jobUrl: getHeaderIndexOrThrow(headerRow, "job_url"),
    status: getHeaderIndexOrThrow(headerRow, "status"),
    rawTextHash: getHeaderIndexOrThrow(headerRow, "raw_text_hash"),
    companyName: getHeaderIndexOrThrow(headerRow, "company_name"),
    roleTitle: getHeaderIndexOrThrow(headerRow, "role_title"),
    workMode: getHeaderIndexOrThrow(headerRow, "work_mode"),
    location: getHeaderIndexOrThrow(headerRow, "location"),
    industry: getHeaderIndexOrThrow(headerRow, "industry"),
    travel: getHeaderIndexOrThrow(headerRow, "travel"),
    clearanceRequired: getHeaderIndexOrThrow(headerRow, "clearanceRequired"),
    governmentAgency: getHeaderIndexOrThrow(headerRow, "govermentAgency"),
    type: getHeaderIndexOrThrow(headerRow, "type"),
    seniority: getHeaderIndexOrThrow(headerRow, "seniority"),
    lastProcessedAt: getHeaderIndexOrThrow(headerRow, "last_processed_at"),
    errorMessage: getHeaderIndexOrThrow(headerRow, "error_message"),
    // JSON columns (primary output)
    salary: getHeaderIndexOptional(headerRow, "salary"),
    // Legacy optional columns
    salaryMin: getHeaderIndexOptional(headerRow, "salary_min"),
    salaryMax: getHeaderIndexOptional(headerRow, "salary_max"),
    currency: getHeaderIndexOptional(headerRow, "currency"),
    salaryPeriod: getHeaderIndexOptional(headerRow, "salary_period"),
    // Validation optional columns
    validationStatus: getHeaderIndexOptional(headerRow, "validation_status"),
    lastErrorStage: getHeaderIndexOptional(headerRow, "last_error_stage"),
    // Token usage optional column
    tokenUsage: getHeaderIndexOptional(headerRow, "token_usage"),
  };
}

async function batchUpdateRowCells(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  sheetTab: string,
  updates: { col: number; row: number; value: string | number }[]
): Promise<void> {
  if (updates.length === 0) return;

  const data = updates.map(({ col, row, value }) => ({
    range: `${sheetTab}!${indexToColumnLetter(col)}${row}`,
    values: [[value]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
}

async function getTabNumericSheetId(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tabTitle: string
): Promise<number> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });
  const sheet = meta.data.sheets?.find(
    (s) => (s.properties?.title ?? "") === tabTitle
  );
  const id = sheet?.properties?.sheetId;
  if (id === undefined || id === null) {
    throw new Error(`Sheet tab not found: ${tabTitle}`);
  }
  return id;
}

/**
 * Delete terminal rows (never row 1) whose status is not_usable or duplicate.
 * Runs only when there are no active fetch/extract statuses in the sheet.
 */
async function removeTerminalRowsWhenPipelineIdle(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetTab: string,
  statusColIndex: number
): Promise<void> {
  const range = `${sheetTab}!${DATA_RANGE}`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const grid = res.data.values ?? [];
  let hasActiveProcessing = false;
  const rowsToDelete1Based: number[] = [];
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const st = String(row[statusColIndex] ?? "").trim().toLowerCase();
    if (
      st === "fetching" ||
      st === "fetching_in_progress" ||
      st === "extracting" ||
      st === "extracting_in_progress"
    ) {
      hasActiveProcessing = true;
      break;
    }
    if (st === "not_usable" || st === "duplicate") {
      rowsToDelete1Based.push(i + 1);
    }
  }
  if (hasActiveProcessing) {
    console.log("[EXTRACT] Skip row cleanup: active fetching/extracting rows still exist");
    return;
  }
  if (rowsToDelete1Based.length === 0) {
    return;
  }

  const tabSheetId = await getTabNumericSheetId(
    sheets,
    spreadsheetId,
    sheetTab
  );
  const uniqueDesc = [...new Set(rowsToDelete1Based.filter((r) => r > 1))].sort(
    (a, b) => b - a
  );
  const requests = uniqueDesc.map((row1Based) => ({
    deleteDimension: {
      range: {
        sheetId: tabSheetId,
        dimension: "ROWS" as const,
        startIndex: row1Based - 1,
        endIndex: row1Based,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
  console.log(
    `[EXTRACT] Removed ${uniqueDesc.length} terminal row(s) [not_usable|duplicate]: ${uniqueDesc
      .slice()
      .sort((a, b) => a - b)
      .join(", ")}`
  );
}

interface SuccessUpdatesResult {
  updates: { col: number; row: number; value: string | number }[];
  wroteSalaryJson: boolean;
}

function addOptionalUpdate(
  updates: { col: number; row: number; value: string | number }[],
  col: number | null,
  row: number,
  value: string | number
): void {
  if (col !== null) {
    updates.push({ col, row, value });
  }
}

function buildSuccessUpdates(
  cols: ColumnIndices,
  rowNum: number,
  extraction: JobExtraction,
  now: string,
  options?: {
    salaryJson?: string;
    validation?: {
      finalStatus: "usable" | "consider" | "not_usable" | "failed";
      validationStatus: "pass" | "failed";
    };
  }
): SuccessUpdatesResult {
  const statusValue = options?.validation?.finalStatus ?? "usable";

  const updates: { col: number; row: number; value: string | number }[] = [
    // Required columns
    { col: cols.status, row: rowNum, value: statusValue },
    { col: cols.companyName, row: rowNum, value: valueToSheet(extraction.company_name) },
    { col: cols.roleTitle, row: rowNum, value: valueToSheet(extraction.role_title) },
    { col: cols.workMode, row: rowNum, value: extraction.work_mode },
    { col: cols.location, row: rowNum, value: valueToSheet(extraction.location) },
    { col: cols.industry, row: rowNum, value: valueToSheet(extraction.industry) },
    { col: cols.travel, row: rowNum, value: valueToSheet(extraction.travel) },
    { col: cols.clearanceRequired, row: rowNum, value: valueToSheet(extraction.clearance_required) },
    { col: cols.governmentAgency, row: rowNum, value: valueToSheet(extraction.government_agency) },
    { col: cols.type, row: rowNum, value: valueToSheet(extraction.type) },
    { col: cols.seniority, row: rowNum, value: valueToSheet(extraction.seniority) },
    { col: cols.lastProcessedAt, row: rowNum, value: now },
    { col: cols.errorMessage, row: rowNum, value: "" },
  ];

  // JSON columns (primary output)
  let wroteSalaryJson = false;

  if (cols.salary !== null) {
    const salaryJson = options?.salaryJson ?? buildSalaryJson(extraction);
    updates.push({ col: cols.salary, row: rowNum, value: salaryJson });
    wroteSalaryJson = true;
  }

  if (options?.validation) {
    addOptionalUpdate(
      updates,
      cols.validationStatus,
      rowNum,
      options.validation.validationStatus
    );
  }

  // Legacy optional columns (write if they exist)
  addOptionalUpdate(updates, cols.salaryMin, rowNum, valueToSheet(extraction.salary_min));
  addOptionalUpdate(updates, cols.salaryMax, rowNum, valueToSheet(extraction.salary_max));
  addOptionalUpdate(updates, cols.currency, rowNum, valueToSheet(extraction.currency));
  addOptionalUpdate(updates, cols.salaryPeriod, rowNum, extraction.salary_period);

  return { updates, wroteSalaryJson };
}

function buildFailureUpdates(
  cols: ColumnIndices,
  rowNum: number,
  status: "failed",
  errorMessage: string,
  now: string
): { col: number; row: number; value: string | number }[] {
  return [
    { col: cols.status, row: rowNum, value: status },
    { col: cols.errorMessage, row: rowNum, value: errorMessage },
    { col: cols.lastProcessedAt, row: rowNum, value: now },
  ];
}

export async function runExtract(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  sheetTab: string
): Promise<void> {
  const range = `${sheetTab}!${DATA_RANGE}`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  const grid = res.data.values ?? [];
  const headerRow = grid[0];
  if (!headerRow?.length) {
    console.error("No header row found");
    return;
  }

  const cols = getColumnIndices(headerRow);

  if (cols.validationStatus === null && !warnedMissingValidationStatusCol) {
    console.warn(
      "[EXTRACT] Warning: 'validation_status' column not found; validation results will not be fully written."
    );
    warnedMissingValidationStatusCol = true;
  }
  if (cols.lastErrorStage === null && !warnedMissingLastErrorStageCol) {
    console.warn(
      "[EXTRACT] Warning: 'last_error_stage' column not found; error stage metadata will not be written."
    );
    warnedMissingLastErrorStageCol = true;
  }
  if (cols.tokenUsage === null && !warnedMissingTokenUsageCol) {
    console.warn(
      "[EXTRACT] Warning: 'token_usage' column not found; token usage will not be written."
    );
    warnedMissingTokenUsageCol = true;
  }

  const toProcess: { sheetRowNum: number; jobUrl: string; hash: string }[] = [];
  for (let i = 1; i < grid.length && toProcess.length < MAX_BATCH; i++) {
    const row = grid[i] ?? [];
    const status = String(row[cols.status] ?? "").trim().toUpperCase();
    const hash = String(row[cols.rawTextHash] ?? "").trim();
    const jobUrl = String(row[cols.jobUrl] ?? "").trim();
    const lastProcessedAtVal = row[cols.lastProcessedAt];
    const canPick =
      hash &&
      (status === "EXTRACTING" ||
        (status === "EXTRACTING_IN_PROGRESS" && isClaimStale(lastProcessedAtVal)));

    if (canPick) {
      toProcess.push({
        sheetRowNum: i + 1,
        jobUrl,
        hash,
      });
    }
  }

  if (toProcess.length === 0) {
    console.log("[EXTRACT] No rows to process");
    await removeTerminalRowsWhenPipelineIdle(sheets, sheetId, sheetTab, cols.status);
    return;
  }

  const now = new Date().toISOString();

  // Dedup: skip extraction if this JD hash was already processed.
  const toDedup = toProcess.filter((item) => dedupHas(item.hash));
  const toExtract = toProcess.filter((item) => !dedupHas(item.hash));

  const allUpdates: { col: number; row: number; value: string | number }[] = [];

  for (const { sheetRowNum } of toDedup) {
    allUpdates.push(
      { col: cols.status, row: sheetRowNum, value: "duplicate" },
      { col: cols.lastProcessedAt, row: sheetRowNum, value: now },
      { col: cols.errorMessage, row: sheetRowNum, value: "" }
    );
    console.log("[DEDUP] hash found, skipping extraction");
  }

  // Claim only rows we will actually extract (avoids duplicate LLM calls / token waste).
  const claimUpdates: { col: number; row: number; value: string | number }[] = [];
  for (const { sheetRowNum } of toExtract) {
    claimUpdates.push(
      { col: cols.status, row: sheetRowNum, value: "extracting_in_progress" },
      { col: cols.lastProcessedAt, row: sheetRowNum, value: now }
    );
  }
  if (claimUpdates.length > 0) {
    await batchUpdateRowCells(sheets, sheetId, sheetTab, claimUpdates);
  }

  if (toExtract.length === 0) {
    if (allUpdates.length > 0) {
      await batchUpdateRowCells(sheets, sheetId, sheetTab, allUpdates);
    }
    await removeTerminalRowsWhenPipelineIdle(sheets, sheetId, sheetTab, cols.status);
    return;
  }

  console.log(`[EXTRACT] Found ${toExtract.length} row(s) to process (parallel)`);

  type ExtractionResult = {
    sheetRowNum: number;
    jobUrl: string;
    hash: string;
    jdText: string;
    extraction: JobExtraction;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const results = await Promise.allSettled(
    toExtract.map(async ({ sheetRowNum, jobUrl, hash }): Promise<ExtractionResult> => {
      const cachePath = join(CACHE_DIR, `${hash}.txt`);
      if (!existsSync(cachePath)) {
        throw new Error(`Cache file not found: ${hash.slice(0, 12)}...`);
      }
      const jdText = readFileSync(cachePath, "utf8");

      const ruleResult = extractWithRules(jdText);
      for (const field of ruleResult.detected) {
        console.log(`[RULE] ${field} detected`);
      }

      const { extraction: openAIExtraction, usage } = await extractJobFields(
        jdText,
        jobUrl
      );
      const extraction = mergeRuleIntoExtraction(
        openAIExtraction,
        ruleResult.extraction
      );

      return { sheetRowNum, jobUrl, hash, jdText, extraction, usage };
    })
  );

  let batchPromptTokens = 0;
  let batchCompletionTokens = 0;
  let batchTotalTokens = 0;

  for (let i = 0; i < results.length; i++) {
    const item = toExtract[i]!;
    const result = results[i]!;

    if (result.status === "fulfilled") {
      const { sheetRowNum, jdText, extraction, usage, hash } = result.value;
      dedupAdd(hash);
      batchPromptTokens += usage.prompt_tokens;
      batchCompletionTokens += usage.completion_tokens;
      batchTotalTokens += usage.total_tokens;

      console.log(
        `[EXTRACT] row ${sheetRowNum} tokens: prompt=${usage.prompt_tokens} completion=${usage.completion_tokens} total=${usage.total_tokens}`
      );

      const salaryJson = buildSalaryJson(extraction);

      const validationInput: ValidateExtractionInput = {
        company_name: extraction.company_name,
        role_title: extraction.role_title,
        work_mode: extraction.work_mode,
        location: extraction.location,
        industry: extraction.industry,
        travel: extraction.travel,
        clearance_required: extraction.clearance_required,
        government_agency: extraction.government_agency, 
        type: extraction.type,
        seniority: extraction.seniority,
        salary_json: salaryJson,
        fetched_text_len: jdText.length,
      };
      const validationResult = validateExtraction(validationInput);

      let finalRowStatus: "usable" | "consider" | "not_usable" | "failed";
      let lastErrorStageValue: string | null = null;

      if (validationResult.validation_status === "pass") {
        finalRowStatus = getExtractionStatusForPassedValidation(extraction);
      } else {
        finalRowStatus = "failed";
        lastErrorStageValue = "validation";
      }

      const { updates, wroteSalaryJson } =
        buildSuccessUpdates(cols, sheetRowNum, extraction, now, {
          salaryJson,
          validation: {
            finalStatus: finalRowStatus,
            validationStatus:
              validationResult.validation_status === "pass" ? "pass" : "failed",
          },
        });

      if (lastErrorStageValue && cols.lastErrorStage !== null) {
        updates.push({
          col: cols.lastErrorStage,
          row: sheetRowNum,
          value: lastErrorStageValue,
        });
      }
      addOptionalUpdate(updates, cols.tokenUsage, sheetRowNum, usage.total_tokens);

      allUpdates.push(...updates);

      const company = extraction.company_name ?? "Unknown";
      const role = extraction.role_title ?? "Unknown";
      const normalizedValidation =
        validationResult.validation_status === "pass" ? "pass" : "failed";
      console.log(
        `[EXTRACT] row ${sheetRowNum} ${normalizedValidation} -> ${finalRowStatus} company=${company} role=${role}`
      );

      if (wroteSalaryJson) {
        console.log(`[EXTRACT] row ${sheetRowNum} wrote salary JSON`);
      }
    } else {
      const reason = result.reason;
      const sheetRowNum = item.sheetRowNum;
      const errMsg =
        reason instanceof Error ? reason.message : String(reason);
      const message = truncateError(errMsg);
      const status: "failed" = "failed";

      const updates = buildFailureUpdates(
        cols,
        sheetRowNum,
        status,
        message,
        now
      );
      if (cols.lastErrorStage !== null) {
        updates.push({
          col: cols.lastErrorStage,
          row: sheetRowNum,
          value: "extract_openai",
        });
      }
      allUpdates.push(...updates);
      console.log(`[EXTRACT] row ${sheetRowNum} ${status}: ${message}`);
    }
  }

  console.log(
    `[EXTRACT] Batch token usage: prompt=${batchPromptTokens} completion=${batchCompletionTokens} total=${batchTotalTokens}`
  );

  if (allUpdates.length > 0) {
    await batchUpdateRowCells(sheets, sheetId, sheetTab, allUpdates);
  }
  await removeTerminalRowsWhenPipelineIdle(sheets, sheetId, sheetTab, cols.status);
}

async function main(): Promise<void> {
  const sheetIdEnv = process.env.SHEET_ID?.trim();
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const sheetTab = process.env.SHEET_TAB?.trim() || "new_jobs";

  if (!sheetIdEnv) {
    console.error("Missing SHEET_ID in .env");
    process.exit(1);
  }
  if (!keyPath) {
    console.error("Missing GOOGLE_APPLICATION_CREDENTIALS in .env");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY in .env");
    process.exit(1);
  }

  const sheetId: string = sheetIdEnv;
  const tab: string = sheetTab;

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  console.log("[EXTRACT] Step 6 extractor started");
  console.log(`[EXTRACT] Polling every ${POLL_INTERVAL_MS / 1000}s, batch size ${MAX_BATCH}`);

  let tickCount = 0;
  async function tick(): Promise<void> {
    tickCount++;
    console.log(`\n[EXTRACT] === Poll cycle #${tickCount} ===`);
    try {
      await runExtract(sheets, sheetId, tab);
    } catch (err) {
      console.error(
        "Extract error:",
        err instanceof Error ? err.message : err
      );
    }
  }

  await tick();
  setInterval(tick, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
