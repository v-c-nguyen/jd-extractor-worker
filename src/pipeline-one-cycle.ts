/**
 * Run one pipeline cycle (poll → fetch → extract) then exit.
 * Used by the dashboard "Run one cycle" action.
 */
import "dotenv/config";
import { google } from "googleapis";
import { chromium } from "playwright";
import { SHEET_CONFIG } from "../config/sheets.js";
import { runPoll } from "./poller.js";
import { runFetch } from "./step5_fetcher.js";
import { runExtract } from "./step6_extractor.js";
import { maybeNotifyTeamSheetsSyncAfterExtract } from "./team_sync_hook.js";

async function main(): Promise<void> {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!keyPath) {
    console.error("Missing GOOGLE_APPLICATION_CREDENTIALS in .env");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY in .env");
    process.exit(1);
  }

  const sheetsToProcess =
    SHEET_CONFIG.length > 0
      ? SHEET_CONFIG
      : process.env.SHEET_ID
        ? [
            {
              spreadsheetId: process.env.SHEET_ID,
              sheetName: (process.env.SHEET_TAB ?? "new_jobs").trim(),
            },
          ]
        : [];

  if (sheetsToProcess.length === 0) {
    console.error("No sheets configured. Set SHEET_CONFIG or SHEET_ID.");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const browser = await chromium.launch();

  try {
    for (const { spreadsheetId, sheetName } of sheetsToProcess) {
      await runPoll(sheets, spreadsheetId, sheetName);
      await runFetch(sheets, spreadsheetId, sheetName, browser);
      await runExtract(sheets, spreadsheetId, sheetName);
    }
    await maybeNotifyTeamSheetsSyncAfterExtract();
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
