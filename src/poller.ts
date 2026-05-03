import "dotenv/config";
import { google } from "googleapis";
import { buildPromoteEmptyJobUrlBatch } from "./sheet_promote_new_rows.js";

const POLL_INTERVAL_MS = 30_000;
/** Must be <= Fetch/Extract MAX_BATCH so we don't add more "fetching" than can be drained per cycle. */
const MAX_BATCH = 3;
const DATA_RANGE = "A:Z";

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

export async function runPoll(
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

  const jobUrlIdx = getHeaderIndexOrThrow(headerRow, "job_url");
  const statusIdx = getHeaderIndexOrThrow(headerRow, "status");
  const lastProcessedIdx = getHeaderIndexOrThrow(
    headerRow,
    "last_processed_at"
  );
  const errorMessageIdx = getHeaderIndexOrThrow(headerRow, "error_message");

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
        `[POLL] Set status=new for ${promotedRowNums.size} row(s) with valid job_url and empty status`
      );
    }
  }

  const toClaim: { sheetRowNum: number; url: string }[] = [];
  const now = new Date();
  for (let i = 1; i < grid.length && toClaim.length < MAX_BATCH; i++) {
    const row = grid[i] ?? [];
    const jobUrl = row[jobUrlIdx];
    const status = row[statusIdx];
    const hasJobUrl =
      jobUrl !== undefined && String(jobUrl).trim() !== "";
    const statusUpper = String(status ?? "").trim().toUpperCase();

    const isNew =
      statusUpper === "NEW" || promotedRowNums.has(i + 1);

    if (hasJobUrl && isNew) {
      toClaim.push({
        sheetRowNum: i + 1,
        url: String(jobUrl).trim(),
      });
    }
  }

  if (toClaim.length === 0) {
    return;
  }

  const nowIso = now.toISOString();
  const data: { range: string; values: (string | number)[][] }[] = [];

  for (const { sheetRowNum, url } of toClaim) {
    const statusLetter = indexToColumnLetter(statusIdx);
    const errorLetter = indexToColumnLetter(errorMessageIdx);
    const lastProcessedLetter = indexToColumnLetter(lastProcessedIdx);

    data.push(
      {
        range: `${sheetTab}!${statusLetter}${sheetRowNum}`,
        values: [["fetching"]],
      },
      {
        range: `${sheetTab}!${errorLetter}${sheetRowNum}`,
        values: [[""]],
      },
      {
        range: `${sheetTab}!${lastProcessedLetter}${sheetRowNum}`,
        values: [[nowIso]],
      }
    );
    console.log(`Claimed row ${sheetRowNum}: ${url}`);
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
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

  async function tick(): Promise<void> {
    try {
      await runPoll(sheets, id, tab);
    } catch (err) {
      console.error("Poll error:", err instanceof Error ? err.message : err);
    }
  }

  await tick();
  setInterval(tick, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
