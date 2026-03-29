import { google } from "googleapis";
import { SHEET_CONFIG } from "@/config/sheets";

const DATA_RANGE = "A:Z";

function getHeaderIndex(
  headerRow: (string | number | boolean | undefined)[],
  name: string
): number | null {
  const idx = headerRow.findIndex(
    (h) => String(h ?? "").trim().toLowerCase() === name.toLowerCase()
  );
  return idx === -1 ? null : idx;
}

export interface JobRow {
  rowNumber: number;
  jobUrl: string;
  status: string;
  detectedSource: string;
  lastUpdated: string;
  company_name?: string | undefined;
  role_title?: string | undefined;
  work_mode?: string | undefined;
  location?: string | undefined;
  industry?: string | undefined;
  travel?: string | undefined;
  clearance_required?: string | undefined;
  government_agency?: string | undefined;
  type?: string | undefined;
  seniority?: string | undefined;
  salary?: string | undefined;
  salary_min?: string | number | undefined;
  salary_max?: string | number | undefined;
  currency?: string | undefined;
  salary_period?: string | undefined;
  raw_text_hash?: string | undefined;
  error_message?: string | undefined;
}

function getSourceFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "—";
  }
}

export async function getSheetsClient() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!keyPath) {
    throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS");
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

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

export async function listJobs(
  sheetIndex = 0
): Promise<{ jobs: JobRow[]; spreadsheetId: string; sheetName: string }> {
  const sheets = await getSheetsClient();
  const all = getSheetsToProcess();
  if (all.length === 0) {
    return { jobs: [], spreadsheetId: "", sheetName: "" };
  }
  const { spreadsheetId, sheetName } = all[sheetIndex]!;
  const range = `${sheetName}!${DATA_RANGE}`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const grid = res.data.values ?? [];
  const headerRow = grid[0] ?? [];
  const jobUrlIdx = getHeaderIndex(headerRow, "job_url");
  const statusIdx = getHeaderIndex(headerRow, "status");
  const lastProcessedIdx = getHeaderIndex(headerRow, "last_processed_at");
  const companyIdx = getHeaderIndex(headerRow, "company_name");
  const roleIdx = getHeaderIndex(headerRow, "role_title");
  const workModeIdx = getHeaderIndex(headerRow, "work_mode");
  const locationIdx = getHeaderIndex(headerRow, "location");
  const industryIdx = getHeaderIndex(headerRow, "industry");
  const travelIdx = getHeaderIndex(headerRow, "travel");
  const clearanceIdx = getHeaderIndex(headerRow, "clearanceRequired");
  const govIdx = getHeaderIndex(headerRow, "govermentAgency");
  const typeIdx = getHeaderIndex(headerRow, "type");
  const seniorityIdx = getHeaderIndex(headerRow, "seniority");
  const salaryIdx = getHeaderIndex(headerRow, "salary");
  const salaryMinIdx = getHeaderIndex(headerRow, "salary_min");
  const salaryMaxIdx = getHeaderIndex(headerRow, "salary_max");
  const currencyIdx = getHeaderIndex(headerRow, "currency");
  const salaryPeriodIdx = getHeaderIndex(headerRow, "salary_period");
  const rawHashIdx = getHeaderIndex(headerRow, "raw_text_hash");
  const errorIdx = getHeaderIndex(headerRow, "error_message");

  const jobs: JobRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const jobUrl = jobUrlIdx !== null ? String(row[jobUrlIdx] ?? "").trim() : "";
    if (!jobUrl) continue;

    const status = statusIdx !== null ? String(row[statusIdx] ?? "").trim() : "";
    const lastUpdated =
      lastProcessedIdx !== null
        ? String(row[lastProcessedIdx] ?? "").trim()
        : "";

    const get = (idx: number | null): string | undefined => {
      if (idx === null) return undefined;
      const v = row[idx];
      if (v === undefined || v === "") return undefined;
      return String(v).trim();
    };
    const getNum = (idx: number | null): string | number | undefined => {
      if (idx === null) return undefined;
      const v = row[idx];
      if (v === undefined || v === "") return undefined;
      if (typeof v === "number") return v;
      return String(v).trim();
    };

    jobs.push({
      rowNumber: i + 1,
      jobUrl,
      status,
      detectedSource: getSourceFromUrl(jobUrl),
      lastUpdated,
      company_name: get(companyIdx ?? null),
      role_title: get(roleIdx ?? null),
      work_mode: get(workModeIdx ?? null),
      location: get(locationIdx ?? null),
      industry: get(industryIdx ?? null),
      travel: get(travelIdx ?? null),
      clearance_required: get(clearanceIdx ?? null),
      government_agency: get(govIdx ?? null),
      type: get(typeIdx ?? null),
      seniority: get(seniorityIdx ?? null),
      salary: get(salaryIdx ?? null),
      salary_min: getNum(salaryMinIdx ?? null),
      salary_max: getNum(salaryMaxIdx ?? null),
      currency: get(currencyIdx ?? null),
      salary_period: get(salaryPeriodIdx ?? null),
      raw_text_hash: get(rawHashIdx ?? null),
      error_message: get(errorIdx ?? null),
    });
  }

  return { jobs, spreadsheetId, sheetName };
}

export async function getJobById(
  rowId: string,
  sheetIndex = 0
): Promise<JobRow | null> {
  const { jobs } = await listJobs(sheetIndex);
  const rowNum = parseInt(rowId, 10);
  if (Number.isNaN(rowNum)) return null;
  return jobs.find((j) => j.rowNumber === rowNum) ?? null;
}

export async function listConfiguredSheets(): Promise<
  { spreadsheetId: string; sheetName: string }[]
> {
  return getSheetsToProcess();
}
