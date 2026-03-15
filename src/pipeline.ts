import "dotenv/config";
import { google } from "googleapis";
import { chromium } from "playwright";
import { runPoll } from "./poller.js";
import { runFetch } from "./step5_fetcher.js";
import { runExtract } from "./step6_extractor.js";

const POLL_INTERVAL_MS = 30_000;

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
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY in .env");
    process.exit(1);
  }

  const id: string = sheetId;
  const tab: string = sheetTab;

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  console.log("[PIPELINE] Starting: poll → fetch → extract");
  console.log("[PIPELINE] Run only one instance per sheet to avoid stuck 'fetching' rows.");
  console.log(`[PIPELINE] Sheet: ${id}, tab: ${tab}`);
  console.log(`[PIPELINE] Cycle every ${POLL_INTERVAL_MS / 1000}s\n`);

  const browser = await chromium.launch();

  let cycle = 0;
  async function tick(): Promise<void> {
    cycle++;
    console.log(`[PIPELINE] === Cycle #${cycle} ===`);
    try {
      await runPoll(sheets, id, tab);
      await runFetch(sheets, id, tab, browser);
      await runExtract(sheets, id, tab);
    } catch (err) {
      console.error(
        "[PIPELINE] Error:",
        err instanceof Error ? err.message : err
      );
    }
    console.log("");
  }

  await tick();
  setInterval(tick, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
