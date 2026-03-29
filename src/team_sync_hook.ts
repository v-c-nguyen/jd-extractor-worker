/**
 * After the worker updates `new_jobs` via the Sheets API, Google does NOT run
 * simple `onEdit` triggers (those only fire for manual UI edits).
 *
 * Optional: set TEAM_SYNC_WEBAPP_URL + TEAM_SYNC_WEBAPP_TOKEN in .env to call
 * an Apps Script Web App that runs `syncAllTeamSheetsFromNewJobs()` — see
 * docs/google-apps-script-sync-saul.gs (`doGet` handler).
 */
export async function maybeNotifyTeamSheetsSyncAfterExtract(): Promise<void> {
  const url = process.env.TEAM_SYNC_WEBAPP_URL?.trim();
  const token = process.env.TEAM_SYNC_WEBAPP_TOKEN?.trim();
  if (!url || !token) {
    return;
  }

  try {
    const u = new URL(url);
    u.searchParams.set("token", token);
    const res = await fetch(u.toString(), { method: "GET" });
    const text = await res.text();
    if (!res.ok) {
      console.warn(
        "[TEAM_SYNC] Web app returned",
        res.status,
        text.slice(0, 200)
      );
      return;
    }
    console.log("[TEAM_SYNC] Notified team sheets sync OK");
  } catch (err) {
    console.warn(
      "[TEAM_SYNC] Failed to notify:",
      err instanceof Error ? err.message : err
    );
  }
}
