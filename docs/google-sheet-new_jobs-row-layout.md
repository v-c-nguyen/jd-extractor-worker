# `new_jobs` row layout (example + Apps Script mapping)

Example data row (your sample):

| Col | Letter | Example value | Role |
|-----|--------|----------------|------|
| 1 | A | `3/16/2026` | Date (not used by Saul sync) |
| 2 | B | `1` | Index/id (not used by Saul sync) |
| 3 | C | `usable` | **Status** — must match `usable` (case-insensitive) |
| 4 | D | `https://ats.rippling.com/...` | **Job URL** — must be non-empty; use rich-text link URL if cell is a hyperlink |
| 5 | E | `Scope3` | **Company** — copied to Saul |
| 6 | F | `FullStack - JS` | **Type** — must be in allow-list after lowercasing (e.g. `fullstack - js`) |
| 7 | G | `Senior Software Engineer` | Role title (not used by basic Saul sync) |
| 8 | H | `Senior` | Seniority (not used by basic Saul sync) |

## Apps Script: `getValues()` row array (0-based)

For `const row = data[i]` from `source.getDataRange().getValues()`:

| Index | Column | Field |
|-------|--------|--------|
| 0 | A | … |
| 1 | B | … |
| 2 | C | **status** → `row[2]` |
| 3 | D | **job URL** → `row[3]` |
| 4 | E | **company** → `row[4]` |
| 5 | F | **type** → `row[5]` |

So: `STATUS_COL = 2`, `JOB_URL_COL = 3`, `COMPANY_COL = 4`, `TYPE_COL = 5` is correct for this layout.

## Filter check for the sample row

1. **URL** — D is plain text with full `https://…` → `getValues()` is enough; no duplicate “Apply” key collision.
2. **Status** — `"usable".toLowerCase().trim()` → passes.
3. **Type** — `"FullStack - JS"` → `"fullstack - js"` → passes if `ALLOWED_TYPES` includes exactly that string (watch for **en-dash** `–` vs hyphen `-`).

## `onEdit` column numbers (1-based)

| Column | Number | Meaning |
|--------|--------|---------|
| C | 3 | Status |
| D | 4 | Job URL |
| E | 5 | Company |
| F | 6 | Type |

In the script, `onEdit` fires when columns **C–F** change (`NJ_EDIT_COL_MIN` / `NJ_EDIT_COL_MAX`).

## `onEdit` vs Sheets API (worker)

**`onEdit` only runs for UI edits**, not when the pipeline updates `new_jobs` via the **Sheets API**.

**After API writes, use one of:**

1. **Time-driven trigger (typical)** — Triggers → `syncAllTeamSheetsFromNewJobs` → every N minutes.
2. **Manual** — Run `runSyncAllTeamSheetsNow()` in the script editor.
3. **Optional Web App** — The Node worker can call an Apps Script URL if you add `doGet` + `TEAM_SYNC_*` in `.env` (see `team_sync_hook.ts`); not required if you use a time trigger.

## Saul sync (Apps Script)

The maintained script is **`google-apps-script-sync-saul.gs`**. It syncs **`new_jobs`** into **multiple tabs** in one run:

| Sheet    | Filter (status `usable` + type) |
|----------|----------------------------------|
| Saul     | Engineering / full-stack list (8 types — see script) |
| Jimmy    | Same as Saul |
| CGlynn   | Same as Saul |
| CSmith   | Same as Saul by default (change `TEAM_SHEET_CONFIG` if needed) |
| CNguyen  | Type **QA** only |

It:

- Copies **only** Saul columns **C:E** (URL, company, type) from filtered `new_jobs` rows.
- **Does not** clear or overwrite other columns on the same row (notes, apply tracking, etc.).
- Updates incrementally; **removes** a whole Saul row when that job leaves the filter (so that row’s extra columns go with it).
- Triggers on edits to `new_jobs` columns **C–F** (status, URL, company, type).

**Duplicate job URLs on `new_jobs`:** For each team tab, only the **first** row (top→bottom) that passes `usable` + that tab’s type filter counts. The URL is normalized (lowercase, strip `?query` and `#fragment`, trim trailing `/`, treat `http` as `https`, drop leading `www.`) before comparing. **Later duplicate URLs are not synced** to that tab; rows stay on `new_jobs` for your records.

**Duplicate company names:** If `DEDUPE_BY_COMPANY_ON_NEW_JOBS` is `true` in the script, only the **first** qualifying row per **normalized** company (trim, lowercase, collapsed spaces) is synced per tab. **Empty company** does not participate (multiple blank-company rows are only limited by URL dedupe). Set the flag to `false` if you want several listings per same employer. Company dedupe runs **after** URL dedupe on the same pass.

**Row identity on team sheets:** Each synced row is still keyed by its **`new_jobs` sheet row number** (the kept row), stored in **column Z** (`SAUL_META_COL`). **Hide column Z** (or change the constant if needed).

**Row order:** After incremental updates, Saul data rows are **reordered** to match **top-to-bottom** order of qualifying rows on `new_jobs` (same order you read the source). Other columns on each row move with that job.

**Saul columns A & B:** The script sets **A** to `1, 2, 3, …` (position in the synced list) and **B** to **today’s date** (spreadsheet timezone) when column **C** has a URL, otherwise **B** is blank. **Remove any formulas from A:B** — the sync reads/writes whole data rows and would replace formulas with values anyway.

Adjust `SAUL_*` constants at the top of that file if your mirrored columns are not C–E.

## Node worker (`lib/sheets-api.ts`, `poller.ts`)

This repo resolves columns by **header names** (`job_url`, `status`, `company_name`, `type`, …), not fixed A–H positions. Ensure row 1 headers match those names if you use the worker against the same sheet.
