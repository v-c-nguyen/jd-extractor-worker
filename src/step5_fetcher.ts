import "dotenv/config";
import { google } from "googleapis";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { fetchWithReadability } from "./fetch/fetch_http.js";
import {
  fetchWithPlaywright,
  type Browser,
  type PlaywrightExtractResult,
} from "./fetch/fetch_playwright.js";
import { sha256Hex } from "./fetch/hash.js";
import { normalizeText } from "./fetch/normalize.js";
import {
  MIN_LEN,
  isBlockedText,
  getBlockedMessage,
  isTooShort,
  classifyError,
} from "./fetch/validate.js";
import { runWithConcurrency } from "./concurrency.js";
import { parseRetryCount, computeNextRetryAt } from "./retry.js";
import { buildPromoteEmptyJobUrlBatch } from "./sheet_promote_new_rows.js";

const POLL_INTERVAL_MS = 30_000;
const DEFAULT_FETCH_CONCURRENCY = 3;
const MIN_FETCH_CONCURRENCY = 1;
const MAX_FETCH_CONCURRENCY = 10;
const MAX_BATCH = 3;
const DATA_RANGE = "A:Z";
const ERROR_MESSAGE_MAX_LEN = 200;
const CACHE_DIR = "cache";
/** Rows stuck in fetching_in_progress longer than this are re-picked (recovery from crash). */
const FETCH_CLAIM_STALE_MS = 5 * 60 * 1000;

const PLAYWRIGHT_ONLY_HOSTS = [
  "workday",
  "linkedin",
  "indeed",
  "ziprecruiter",
  "icims",
];

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

function getHeaderIndexOptional(
  headerRow: (string | number | boolean | undefined)[],
  name: string
): number | null {
  const idx = headerRow.findIndex(
    (h) => String(h ?? "").trim().toLowerCase() === name.toLowerCase()
  );
  return idx === -1 ? null : idx;
}

let warnedMissingRetryCountCol = false;
let warnedMissingLastErrorStageCol = false;
let warnedMissingNextRetryAtCol = false;

function hostnameRequiresPlaywright(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PLAYWRIGHT_ONLY_HOSTS.some((h) => host.includes(h));
  } catch {
    return false;
  }
}

function truncateError(msg: string): string {
  if (msg.length <= ERROR_MESSAGE_MAX_LEN) return msg;
  return msg.slice(0, ERROR_MESSAGE_MAX_LEN - 3) + "...";
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function isClaimStale(lastProcessedAtVal: unknown): boolean {
  const s = String(lastProcessedAtVal ?? "").trim();
  if (!s) return true;
  const t = Date.parse(s);
  return Number.isNaN(t) || Date.now() - t > FETCH_CLAIM_STALE_MS;
}

interface ExtractResult {
  text: string;
  httpLen: number;
  pwLen: number;
  strategy: "http" | "playwright" | "http+playwright";
  greenhouseClean?: { beforeLen: number; afterLen: number } | undefined;
}

async function extractTextForUrl(
  url: string,
  browser: Browser
): Promise<ExtractResult> {
  const forcePw = hostnameRequiresPlaywright(url);

  if (forcePw) {
    const pwResult = await fetchWithPlaywright(browser, url);
    return {
      text: pwResult.text,
      httpLen: 0,
      pwLen: pwResult.text.length,
      strategy: "playwright",
      greenhouseClean: pwResult.greenhouseClean,
    };
  }

  let httpText = "";
  let httpError: Error | null = null;
  try {
    httpText = await fetchWithReadability(url);
  } catch (err) {
    httpError = err instanceof Error ? err : new Error(String(err));
  }

  if (httpText.length >= MIN_LEN) {
    return {
      text: httpText,
      httpLen: httpText.length,
      pwLen: 0,
      strategy: "http",
    };
  }

  let pwResult: PlaywrightExtractResult;
  try {
    pwResult = await fetchWithPlaywright(browser, url);
  } catch (err) {
    if (httpError) throw httpError;
    throw err;
  }

  if (pwResult.text.length >= httpText.length) {
    return {
      text: pwResult.text,
      httpLen: httpText.length,
      pwLen: pwResult.text.length,
      strategy: "http+playwright",
      greenhouseClean: pwResult.greenhouseClean,
    };
  }

  return {
    text: httpText,
    httpLen: httpText.length,
    pwLen: pwResult.text.length,
    strategy: "http+playwright",
  };
}

export async function runFetch(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  sheetTab: string,
  browser: Browser
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

  const jobUrlIdx = getHeaderIndexOrThrow(headerRow, "job_url");
  const statusIdx = getHeaderIndexOrThrow(headerRow, "status");
  const fetchedTextLenIdx = getHeaderIndexOrThrow(headerRow, "fetched_text_len");
  const rawTextHashIdx = getHeaderIndexOrThrow(headerRow, "raw_text_hash");
  const lastProcessedIdx = getHeaderIndexOrThrow(
    headerRow,
    "last_processed_at"
  );
  const errorMessageIdx = getHeaderIndexOrThrow(headerRow, "error_message");

  const retryCountIdx = getHeaderIndexOptional(headerRow, "retry_count");
  const lastErrorStageIdx = getHeaderIndexOptional(headerRow, "last_error_stage");
  const nextRetryAtIdx = getHeaderIndexOptional(headerRow, "next_retry_at");

  if (retryCountIdx === null && !warnedMissingRetryCountCol) {
    console.warn(
      "[FETCH] Warning: 'retry_count' column not found; retry metadata will not be fully written."
    );
    warnedMissingRetryCountCol = true;
  }
  if (lastErrorStageIdx === null && !warnedMissingLastErrorStageCol) {
    console.warn(
      "[FETCH] Warning: 'last_error_stage' column not found; retry metadata will not be fully written."
    );
    warnedMissingLastErrorStageCol = true;
  }
  if (nextRetryAtIdx === null && !warnedMissingNextRetryAtCol) {
    console.warn(
      "[FETCH] Warning: 'next_retry_at' column not found; retry scheduling will be limited."
    );
    warnedMissingNextRetryAtCol = true;
  }

  const { updates: promoteUpdates, promotedRowNums } = buildPromoteEmptyJobUrlBatch(
    grid,
    sheetTab,
    jobUrlIdx,
    statusIdx,
    errorMessageIdx,
    indexToColumnLetter
  );
  if (promoteUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "RAW", data: promoteUpdates },
    });
    if (promotedRowNums.size > 0) {
      console.log(
        `[FETCH] Set status=new for ${promotedRowNums.size} row(s) with valid job_url and empty status`
      );
    }
  }

  const toProcess: { sheetRowNum: number; url: string }[] = [];
  for (let i = 1; i < grid.length && toProcess.length < MAX_BATCH; i++) {
    const row = grid[i] ?? [];
    const jobUrl = row[jobUrlIdx];
    const status = row[statusIdx];
    const statusLower = String(status ?? "").trim().toLowerCase();
    const hasJobUrl =
      jobUrl !== undefined && String(jobUrl).trim() !== "";
    const lastProcessedAtVal = row[lastProcessedIdx];
    const canPick =
      hasJobUrl &&
      (statusLower === "fetching" ||
        (statusLower === "fetching_in_progress" && isClaimStale(lastProcessedAtVal)));
    if (canPick) {
      toProcess.push({
        sheetRowNum: i + 1,
        url: String(jobUrl).trim(),
      });
    }
  }

  if (toProcess.length === 0) return;

  mkdirSync(CACHE_DIR, { recursive: true });
  const now = new Date().toISOString();

  // Claim rows so other processes don't pick them (avoids duplicate fetch then duplicate extract).
  const claimData: { range: string; values: (string | number)[][] }[] = [];
  for (const { sheetRowNum } of toProcess) {
    const statusLetter = indexToColumnLetter(statusIdx);
    const lastProcessedLetter = indexToColumnLetter(lastProcessedIdx);
    claimData.push(
      { range: `${sheetTab}!${statusLetter}${sheetRowNum}`, values: [["fetching_in_progress"]] },
      { range: `${sheetTab}!${lastProcessedLetter}${sheetRowNum}`, values: [[now]] }
    );
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "RAW", data: claimData },
  });

  const concurrencyRaw = process.env.FETCH_CONCURRENCY?.trim();
  const parsed = concurrencyRaw ? Math.floor(Number(concurrencyRaw)) : DEFAULT_FETCH_CONCURRENCY;
  const concurrency = Number.isNaN(parsed)
    ? DEFAULT_FETCH_CONCURRENCY
    : Math.min(MAX_FETCH_CONCURRENCY, Math.max(MIN_FETCH_CONCURRENCY, parsed));

  type FetchRowSuccess = {
    sheetRowNum: number;
    url: string;
    host: string;
    outcome: "success";
    text: string;
    hash: string;
    result: ExtractResult;
    greenhouseClean?: { beforeLen: number; afterLen: number } | undefined;
  };
  type FetchRowBlocked = {
    sheetRowNum: number;
    host: string;
    outcome: "blocked";
    message: string;
    stage: string;
  };
  type FetchRowTooShort = {
    sheetRowNum: number;
    host: string;
    outcome: "too_short";
    message: string;
    stage: string;
  };
  type FetchRowError = {
    sheetRowNum: number;
    url: string;
    host: string;
    outcome: "error";
    message: string;
    stage: string;
    status: "retry" | "failed";
    currentRetryCount: number;
    newRetryCount: number;
    nextRetryAt: string | null;
  };
  type FetchRowResult =
    | FetchRowSuccess
    | FetchRowBlocked
    | FetchRowTooShort
    | FetchRowError;

  const task = async (
    item: { sheetRowNum: number; url: string }
  ): Promise<FetchRowResult> => {
    const { sheetRowNum, url } = item;
    const host = getHostname(url);
    console.log(`[FETCH] starting row ${sheetRowNum}`);

    try {
      const result = await extractTextForUrl(url, browser);
      const text = normalizeText(result.text);

      if (isBlockedText(text)) {
        const message = getBlockedMessage(text);
        const stage =
          result.strategy === "playwright" || result.strategy === "http+playwright"
            ? "fetch_playwright"
            : "fetch_http";
        return {
          sheetRowNum,
          host,
          outcome: "blocked",
          message,
          stage,
        };
      }

      if (isTooShort(text)) {
        const message = `Text too short (${text.length} < ${MIN_LEN})`;
        const stage =
          result.strategy === "playwright" || result.strategy === "http+playwright"
            ? "fetch_playwright"
            : "fetch_http";
        return {
          sheetRowNum,
          host,
          outcome: "too_short",
          message,
          stage,
        };
      }

      const hash = sha256Hex(text);
      const cachePath = join(CACHE_DIR, `${hash}.txt`);
      writeFileSync(cachePath, text, "utf8");

      console.log(`[FETCH] finished row ${sheetRowNum} len=${text.length}`);
      return {
        sheetRowNum,
        url,
        host,
        outcome: "success",
        text,
        hash,
        result,
        greenhouseClean: result.greenhouseClean,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const classification = classifyError(errMsg);
      const message = truncateError(errMsg);
      const row = grid[sheetRowNum - 1] ?? [];
      const currentRetryCount = parseRetryCount(
        retryCountIdx !== null ? row[retryCountIdx] : undefined
      );
      const stage = hostnameRequiresPlaywright(url)
        ? "fetch_playwright"
        : "fetch_http";

      let status: "retry" | "failed" = classification;
      let newRetryCount = currentRetryCount;
      let nextRetryAt: string | null = null;

      if (
        classification === "retry" &&
        retryCountIdx !== null &&
        nextRetryAtIdx !== null
      ) {
        if (currentRetryCount >= 3) {
          status = "failed";
          nextRetryAt = "";
        } else {
          newRetryCount = currentRetryCount + 1;
          nextRetryAt = computeNextRetryAt(newRetryCount);
        }
      }

      return {
        sheetRowNum,
        url,
        host,
        outcome: "error",
        message,
        stage,
        status,
        currentRetryCount,
        newRetryCount,
        nextRetryAt,
      };
    }
  };

  const results = await runWithConcurrency(toProcess, concurrency, task);

  const statusLetter = indexToColumnLetter(statusIdx);
  const fetchedTextLenLetter = indexToColumnLetter(fetchedTextLenIdx);
  const rawTextHashLetter = indexToColumnLetter(rawTextHashIdx);
  const lastProcessedLetter = indexToColumnLetter(lastProcessedIdx);
  const errorMessageLetter = indexToColumnLetter(errorMessageIdx);
  const retryCountLetter =
    retryCountIdx !== null ? indexToColumnLetter(retryCountIdx) : null;
  const lastErrorStageLetter =
    lastErrorStageIdx !== null ? indexToColumnLetter(lastErrorStageIdx) : null;
  const nextRetryAtLetter =
    nextRetryAtIdx !== null ? indexToColumnLetter(nextRetryAtIdx) : null;

  const allData: { range: string; values: (string | number)[][] }[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    const item = toProcess[i]!;
    const sheetRowNum = item.sheetRowNum;

    if (result.status === "rejected") {
      const message = truncateError(
        result.reason instanceof Error ? result.reason.message : String(result.reason)
      );
      allData.push(
        { range: `${sheetTab}!${statusLetter}${sheetRowNum}`, values: [["failed"]] },
        { range: `${sheetTab}!${errorMessageLetter}${sheetRowNum}`, values: [[message]] },
        { range: `${sheetTab}!${lastProcessedLetter}${sheetRowNum}`, values: [[now]] }
      );
      if (lastErrorStageLetter) {
        allData.push({
          range: `${sheetTab}!${lastErrorStageLetter}${sheetRowNum}`,
          values: [["fetch_http"]],
        });
      }
      console.log(`[FETCH] row ${sheetRowNum} failed: ${message}`);
      continue;
    }

    const value = result.value;

    if (value.outcome === "blocked") {
      allData.push(
        { range: `${sheetTab}!${statusLetter}${sheetRowNum}`, values: [["failed"]] },
        { range: `${sheetTab}!${errorMessageLetter}${sheetRowNum}`, values: [[value.message]] },
        { range: `${sheetTab}!${lastProcessedLetter}${sheetRowNum}`, values: [[now]] }
      );
      if (lastErrorStageLetter) {
        allData.push({
          range: `${sheetTab}!${lastErrorStageLetter}${sheetRowNum}`,
          values: [[value.stage]],
        });
      }
      if (nextRetryAtLetter) {
        allData.push({
          range: `${sheetTab}!${nextRetryAtLetter}${sheetRowNum}`,
          values: [[""]],
        });
      }
      console.log(
        `[FETCH] row ${sheetRowNum} host=${value.host} failed: ${value.message}`
      );
      continue;
    }

    if (value.outcome === "too_short") {
      allData.push(
        { range: `${sheetTab}!${statusLetter}${sheetRowNum}`, values: [["failed"]] },
        { range: `${sheetTab}!${errorMessageLetter}${sheetRowNum}`, values: [[value.message]] },
        { range: `${sheetTab}!${lastProcessedLetter}${sheetRowNum}`, values: [[now]] }
      );
      if (lastErrorStageLetter) {
        allData.push({
          range: `${sheetTab}!${lastErrorStageLetter}${sheetRowNum}`,
          values: [[value.stage]],
        });
      }
      if (nextRetryAtLetter) {
        allData.push({
          range: `${sheetTab}!${nextRetryAtLetter}${sheetRowNum}`,
          values: [[""]],
        });
      }
      console.log(
        `[FETCH] row ${sheetRowNum} host=${value.host} failed: ${value.message}`
      );
      continue;
    }

    if (value.outcome === "error") {
      allData.push(
        { range: `${sheetTab}!${statusLetter}${sheetRowNum}`, values: [[value.status]] },
        { range: `${sheetTab}!${errorMessageLetter}${sheetRowNum}`, values: [[value.message]] },
        { range: `${sheetTab}!${lastProcessedLetter}${sheetRowNum}`, values: [[now]] }
      );
      if (lastErrorStageLetter) {
        allData.push({
          range: `${sheetTab}!${lastErrorStageLetter}${sheetRowNum}`,
          values: [[value.stage]],
        });
      }
      if (retryCountLetter && value.newRetryCount !== value.currentRetryCount) {
        allData.push({
          range: `${sheetTab}!${retryCountLetter}${sheetRowNum}`,
          values: [[value.newRetryCount]],
        });
      }
      if (nextRetryAtLetter) {
        allData.push({
          range: `${sheetTab}!${nextRetryAtLetter}${sheetRowNum}`,
          values: [[value.nextRetryAt ?? ""]],
        });
      }
      if (value.status === "retry") {
        console.log(
          `[RETRY] row ${sheetRowNum} retry_count=${value.newRetryCount} next_retry_at=${value.nextRetryAt} stage=${value.stage}`
        );
      } else {
        console.log(
          `[failed] row ${sheetRowNum} exceeded retries stage=${value.stage}`
        );
      }
      console.log(`[FETCH] row ${sheetRowNum} host=${value.host} ${value.status}: ${value.message}`);
      continue;
    }

    // value.outcome === "success"
    allData.push(
      { range: `${sheetTab}!${statusLetter}${sheetRowNum}`, values: [["extracting"]] },
      { range: `${sheetTab}!${fetchedTextLenLetter}${sheetRowNum}`, values: [[value.text.length]] },
      { range: `${sheetTab}!${rawTextHashLetter}${sheetRowNum}`, values: [[value.hash]] },
      { range: `${sheetTab}!${errorMessageLetter}${sheetRowNum}`, values: [[""]] },
      { range: `${sheetTab}!${lastProcessedLetter}${sheetRowNum}`, values: [[now]] }
    );
    if (value.greenhouseClean) {
      console.log(
        `[FETCH][GH] row ${sheetRowNum} cleaned len ${value.greenhouseClean.beforeLen} -> ${value.greenhouseClean.afterLen}`
      );
    }
  }

  if (allData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "RAW", data: allData },
    });
  }
}

async function main(): Promise<void> {
  const sheetId = process.env.SHEET_ID?.trim();
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const sheetTab = process.env.SHEET_TAB?.trim() || "new_jobs";

  if (!sheetId) {
    console.error("Missing SHEET_ID in .env");
    process.exit(1);
  }
  if (!keyPath) {
    console.error("Missing GOOGLE_APPLICATION_CREDENTIALS in .env");
    process.exit(1);
  }

  const id: string = sheetId;
  const tab: string = sheetTab;

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const browser = await chromium.launch();

  async function tick(): Promise<void> {
    try {
      await runFetch(sheets, id, tab, browser);
    } catch (err) {
      console.error(
        "Fetch error:",
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
