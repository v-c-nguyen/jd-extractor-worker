import "dotenv/config";
import { google } from "googleapis";
import { chromium } from "playwright";
import { SHEET_CONFIG } from "../config/sheets.js";
import { runPoll } from "./poller.js";
import { runFetch } from "./step5_fetcher.js";
import { runExtract } from "./step6_extractor.js";
import { maybeNotifyTeamSheetsSyncAfterExtract } from "./team_sync_hook.js";

const POLL_INTERVAL_MS = 30_000;

/** Build list of sheets to process: from config, or single sheet from env if config empty. */
function getSheetsToProcess(): { spreadsheetId: string; sheetName: string }[] {
  if (SHEET_CONFIG.length > 0) {
    return SHEET_CONFIG.map((e) => ({
      spreadsheetId: e.spreadsheetId,
      sheetName: e.sheetName,
    }));
  }
  const sheetId = process.env.SHEET_ID?.trim();
  const sheetTab = process.env.SHEET_TAB?.trim() || "new_jobs";
  if (sheetId) {
    return [{ spreadsheetId: sheetId, sheetName: sheetTab }];
  }
  return [];
}

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

  const sheetsToProcess = getSheetsToProcess();
  if (sheetsToProcess.length === 0) {
    console.error("No sheets to process. Set SHEET_CONFIG in config/sheets.ts or SHEET_ID (and optionally SHEET_TAB) in .env");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  console.log("[PIPELINE] Starting: poll → fetch → extract");
  console.log("[PIPELINE] Run only one instance per sheet to avoid stuck 'fetching' rows.");
  console.log(`[PIPELINE] Sheets: ${sheetsToProcess.length} (${sheetsToProcess.map((s) => s.sheetName).join(", ")})`);
  console.log(`[PIPELINE] Cycle every ${POLL_INTERVAL_MS / 1000}s\n`);

  const browser = await chromium.launch();

  let cycle = 0;
  async function tick(): Promise<void> {
    cycle++;
    console.log(`[PIPELINE] === Cycle #${cycle} ===`);
    for (const { spreadsheetId, sheetName } of sheetsToProcess) {
      try {
        console.log(`[SHEET] processing ${sheetName}`);
        await runPoll(sheets, spreadsheetId, sheetName);
        await runFetch(sheets, spreadsheetId, sheetName, browser);
        await runExtract(sheets, spreadsheetId, sheetName);
      } catch (err) {
        console.error(
          `[SHEET] ${sheetName} error:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    await maybeNotifyTeamSheetsSyncAfterExtract();
    console.log("");
  }

  await tick();
  setInterval(tick, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
