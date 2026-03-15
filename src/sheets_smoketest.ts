import "dotenv/config";
import { google } from "googleapis";

const SHEET_TAB = "new_jobs";
const TARGET_STATUS = "new";

function colIndexToLetter(index: number): string {
  let colNum = index + 1;
  let s = "";
  while (colNum > 0) {
    s = String.fromCharCode(65 + ((colNum - 1) % 26)) + s;
    colNum = Math.floor((colNum - 1) / 26);
  }
  return s;
}

async function main(): Promise<void> {
  const sheetId = process.env.SHEET_ID;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!sheetId?.trim()) {
    console.error("Missing SHEET_ID in .env");
    process.exit(1);
  }
  if (!keyPath?.trim()) {
    console.error("Missing GOOGLE_APPLICATION_CREDENTIALS in .env");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const rangeHeader = `${SHEET_TAB}!A1:Z1`;
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: rangeHeader,
  });
  const headerRow = headerRes.data.values?.[0];
  if (!headerRow?.length) {
    console.error("No header row found on tab 'new_jobs'");
    process.exit(1);
  }

  const jobUrlIndex = headerRow.findIndex(
    (h) => String(h).trim().toLowerCase() === "job_url"
  );
  const statusIndex = headerRow.findIndex(
    (h) => String(h).trim().toLowerCase() === "status"
  );

  if (jobUrlIndex === -1) {
    console.error("Required column 'job_url' not found in header");
    process.exit(1);
  }
  if (statusIndex === -1) {
    console.error("Required column 'status' not found in header");
    process.exit(1);
  }

  const rangeData = `${SHEET_TAB}!A2:Z`;
  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: rangeData,
  });
  const rows = dataRes.data.values ?? [];
  let targetRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const jobUrl = row?.[jobUrlIndex];
    const status = row?.[statusIndex];
    const hasJobUrl =
      jobUrl !== undefined && String(jobUrl).trim() !== "";
    const isEmptyStatus =
      status === undefined || String(status).trim() === "";
    if (hasJobUrl && isEmptyStatus) {
      targetRowIndex = i;
      break;
    }
  }

  if (targetRowIndex === -1) {
    console.error("No row found with job_url set and status empty");
    process.exit(1);
  }

  const sheetRowNum = targetRowIndex + 2;
  const statusColLetter = colIndexToLetter(statusIndex);
  const updateRange = `${SHEET_TAB}!${statusColLetter}${sheetRowNum}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: updateRange,
    valueInputOption: "RAW",
    requestBody: { values: [[TARGET_STATUS]] },
  });

  console.log(
    `Success: updated status to "${TARGET_STATUS}" at ${updateRange}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
