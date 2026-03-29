/**
 * Multi-sheet configuration for the job extraction pipeline.
 * Each entry is processed independently; errors in one sheet do not stop others.
 */

export interface SheetEntry {
  spreadsheetId: string;
  sheetName: string;
}

export const SHEET_CONFIG: SheetEntry[] = [
  { spreadsheetId: "1GQgzI64NiT2GzQqQ0U75RKiRwr4oG92Ki23FHL50iIM", sheetName: "new_jobs" },
];
