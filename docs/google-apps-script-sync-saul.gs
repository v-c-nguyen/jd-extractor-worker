/**
 * new_jobs → team sheets (Saul, Jimmy, CNguyen, CSmith, CGlynn, Daniel)
 *
 * - Rows with status usable (+ usable_for_saul on Saul only) + type in each tab’s allow-list; meta Z = new_jobs row #; C:E = URL/company/type.
 * - new_jobs column A = date when job URL (D) is present; cleared when D is empty (UI edit on D or time-driven sync).
 * - URL dedupe (normalized); optional company dedupe (DEDUPE_BY_COMPANY_ON_NEW_JOBS).
 * - Pipeline/API updates do NOT fire onEdit — add a time-driven trigger on
 *   syncAllTeamSheetsFromNewJobs (recommended) or rely on onEdit for manual edits only.
 *
 * Setup: paste in Extensions → Apps Script, authorize, run runSyncAllTeamSheetsNow() once,
 * then Triggers → syncAllTeamSheetsFromNewJobs → time-driven (e.g. every 5–10 min).
 */

var SAUL_DATA_START_ROW = 2;

var SAUL_NO_COL = 1;
var SAUL_DATE_COL = 2;
var SAUL_URL_COL = 3;
var SAUL_COMPANY_COL = 4;
var SAUL_TYPE_COL = 5;
var SAUL_SYNC_NUM_COLS = 3;
var SAUL_META_COL = 26;

/** 0-based indices into new_jobs row arrays (getValues) — columns C..F */
var NJ_STATUS_COL = 2;
var NJ_JOB_URL_COL = 3;
var NJ_COMPANY_COL = 4;
var NJ_TYPE_COL = 5;
var NJ_HEADER_ROWS = 1;

/** 1-based: column A = added-date stamp when job URL (D) is first present */
var NJ_ADDED_DATE_COL = 1;
var NJ_STATUS_COL_1_BASED = NJ_STATUS_COL + 1;

/** 1-based sheet columns C–F: sync on manual edit of status/URL/company/type */
var NJ_EDIT_COL_MIN = 3;
var NJ_EDIT_COL_MAX = 6;

var DEDUPE_BY_COMPANY_ON_NEW_JOBS = true;

/**
 * Job types that sync to Saul, Jimmy, CSmith, and CGlynn (same pool as AI + Full Stack roles).
 * Do NOT add DevOps or other engineering types to QA_TYPE_LABELS — CNguyen is QA-only.
 */
var ENGINEERING_TYPE_LABELS = [
  "AI Integration - Full Stack",
  "Applied AI & Automation",
  "DevOps",
  "FullStack - JS",
  "FullStack - Go",
  "FullStack - Ruby",
  "FullStack - Python",
  "FullStack - C#",
  "FullStack - PHP",
  "FullStack - Java",
];

/** CNguyen only — strictly QA; engineering types stay in ENGINEERING_TYPE_LABELS. */
var QA_TYPE_LABELS = ["QA"];

/** Daniel only — tech support / solutions roles; not mixed into engineering tabs. */
var DANIEL_TYPE_LABELS = ["Tech Support or Solutions"];

function normalizeTypeForFilter(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ");
}

function buildAllowedTypesSet(labels) {
  var s = new Set();
  for (var i = 0; i < labels.length; i++) {
    s.add(normalizeTypeForFilter(labels[i]));
  }
  return s;
}

var ENGINEERING_TYPES_SET = buildAllowedTypesSet(ENGINEERING_TYPE_LABELS);
var QA_TYPES_SET = buildAllowedTypesSet(QA_TYPE_LABELS);
var DANIEL_TYPES_SET = buildAllowedTypesSet(DANIEL_TYPE_LABELS);
var ALL_ALLOWED_TYPES_SET = (function () {
  var s = new Set();
  ENGINEERING_TYPES_SET.forEach(function (v) {
    s.add(v);
  });
  QA_TYPES_SET.forEach(function (v) {
    s.add(v);
  });
  DANIEL_TYPES_SET.forEach(function (v) {
    s.add(v);
  });
  return s;
})();

var TEAM_SHEET_CONFIG = [
  {
    sheetName: "Saul",
    allowedTypes: ENGINEERING_TYPES_SET,
    allowUsableForSaulStatus: true,
  },
  { sheetName: "Jimmy", allowedTypes: ENGINEERING_TYPES_SET },
  { sheetName: "CNguyen", allowedTypes: QA_TYPES_SET /* QA only — not AI/FullStack/DevOps */ },
  { sheetName: "CSmith", allowedTypes: ENGINEERING_TYPES_SET },
  { sheetName: "CGlynn", allowedTypes: ENGINEERING_TYPES_SET },
  { sheetName: "Daniel", allowedTypes: DANIEL_TYPES_SET },
];

function getCanonicalJobUrl(richCell, plainFromValues) {
  var richUrl = "";
  if (richCell && typeof richCell.getLinkUrl === "function") {
    var u = richCell.getLinkUrl();
    if (u) richUrl = String(u).trim();
  }
  var plain = String(plainFromValues || "").trim();
  return richUrl || plain;
}

function normalizeJobUrlForDedupe(url) {
  var s = String(url || "").trim();
  if (!s) return "";
  s = s.replace(/#.*$/, "");

  // Apps Script-safe URL parsing via regex/string operations.
  var m = s.match(/^(https?):\/\/([^\/?#]+)([^?#]*)?(\?[^#]*)?$/i);
  if (!m) {
    var fallback = s.toLowerCase();
    while (fallback.length > 1 && fallback.charAt(fallback.length - 1) === "/") {
      fallback = fallback.substring(0, fallback.length - 1);
    }
    if (fallback.indexOf("http://") === 0) fallback = "https://" + fallback.substring(7);
    if (fallback.indexOf("https://www.") === 0) fallback = "https://" + fallback.substring(8);
    return fallback;
  }

  var protocol = "https:";
  var host = String(m[2] || "").toLowerCase();
  if (host.indexOf("www.") === 0) host = host.substring(4);
  var path = String(m[3] || "");
  if (!path) path = "/";
  while (path.length > 1 && path.charAt(path.length - 1) === "/") {
    path = path.substring(0, path.length - 1);
  }

  // Keep only identity-like params so different jobs don't collide
  // (e.g. Greenhouse embed links differ in for/token/jr_id).
  var keepParamKeys = {
    jr_id: true,
    token: true,
    gh_jid: true,
    jid: true,
    job_id: true,
    jobid: true,
    req_id: true,
    requisitionid: true,
    for: true,
  };
  var keptMap = {};
  var query = String(m[4] || "");
  if (query.indexOf("?") === 0) query = query.substring(1);
  if (query) {
    var pairs = query.split("&");
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i];
      if (!pair) continue;
      var eq = pair.indexOf("=");
      var rawKey = eq >= 0 ? pair.substring(0, eq) : pair;
      var rawVal = eq >= 0 ? pair.substring(eq + 1) : "";
      var key = decodeURIComponent(String(rawKey || "").replace(/\+/g, " "))
        .toLowerCase()
        .trim();
      if (!keepParamKeys[key]) continue;
      var val = decodeURIComponent(String(rawVal || "").replace(/\+/g, " "))
        .toLowerCase()
        .trim();
      if (!val) continue;
      keptMap[key] = val;
    }
  }

  var kept = Object.keys(keptMap).sort();
  var keptParts = [];
  for (var j = 0; j < kept.length; j++) {
    var k = kept[j];
    keptParts.push(k + "=" + keptMap[k]);
  }
  return protocol + "//" + host + path + (keptParts.length ? "?" + keptParts.join("&") : "");
}

function normalizeCompanyForDedupe(raw) {
  var s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  return s.replace(/\s+/g, " ");
}

function parseMetaNjRow(cell) {
  if (typeof cell === "number" && isFinite(cell)) return Math.floor(cell);
  var s = String(cell || "").trim();
  if (!s) return NaN;
  var n = parseInt(s, 10);
  return isNaN(n) ? NaN : n;
}

function tripleEqual(a, b) {
  return (
    String(a[0] || "").trim() === String(b[0] || "").trim() &&
    String(a[1] || "").trim() === String(b[1] || "").trim() &&
    String(a[2] || "").trim() === String(b[2] || "").trim()
  );
}

function saulDateTodayOrEmpty(spreadsheet, urlCellValue) {
  if (!String(urlCellValue || "").trim()) return "";
  var tz = spreadsheet.getSpreadsheetTimeZone();
  var ymd = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  return Utilities.parseDate(ymd, tz, "yyyy-MM-dd");
}

function preserveSaulDateOrSetToday(spreadsheet, urlCellValue, existingDateValue) {
  if (!String(urlCellValue || "").trim()) return "";
  if (existingDateValue instanceof Date) return existingDateValue;
  if (String(existingDateValue || "").trim()) return existingDateValue;
  return saulDateTodayOrEmpty(spreadsheet, urlCellValue);
}

function newJobsSheetDateStampValue(spreadsheet) {
  var tz = spreadsheet.getSpreadsheetTimeZone();
  var ymd = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  return Utilities.parseDate(ymd, tz, "yyyy-MM-dd");
}

function rangeIntersectsColumn1Based(range, col1Based) {
  var c0 = range.getColumn();
  var c1 = c0 + range.getNumColumns() - 1;
  return c0 <= col1Based && c1 >= col1Based;
}

/** Keep new_jobs column A in sync with D: date when URL present (first time only); empty when D has no URL. */
function syncNewJobsAddedDateColumnForRow(spreadsheet, sheet, row1Based) {
  if (row1Based <= NJ_HEADER_ROWS) return;
  var urlCol = NJ_JOB_URL_COL + 1;
  var urlRange = sheet.getRange(row1Based, urlCol);
  var jobUrl = getCanonicalJobUrl(
    urlRange.getRichTextValue(),
    urlRange.getValue()
  );
  var aCell = sheet.getRange(row1Based, NJ_ADDED_DATE_COL);
  if (!String(jobUrl || "").trim()) {
    aCell.setValue("");
    return;
  }
  if (String(aCell.getValue() || "").trim()) return;
  aCell.setValue(newJobsSheetDateStampValue(spreadsheet));
}

/** Align column A with column D for all loaded rows (API/pipeline + clears date when URL removed). */
function syncNewJobsAddedDatesFromSource(spreadsheet, sourceSheet, srcData, srcRichUrls) {
  var dv = newJobsSheetDateStampValue(spreadsheet);
  for (var ir = NJ_HEADER_ROWS; ir < srcData.length; ir++) {
    var rowData = srcData[ir];
    var jobUrl = getCanonicalJobUrl(srcRichUrls[ir][0], rowData[NJ_JOB_URL_COL]);
    var rowNum = ir + 1;
    var aCell = sourceSheet.getRange(rowNum, NJ_ADDED_DATE_COL);
    if (!String(jobUrl || "").trim()) {
      if (String(rowData[NJ_ADDED_DATE_COL - 1] || "").trim()) {
        aCell.setValue("");
      }
      continue;
    }
    if (String(rowData[NJ_ADDED_DATE_COL - 1] || "").trim()) continue;
    aCell.setValue(dv);
  }
}

function dateKeyForSaulCounter(dateValue, timezone) {
  if (!dateValue) return "";
  if (dateValue instanceof Date) {
    return Utilities.formatDate(dateValue, timezone, "yyyy-MM-dd");
  }
  var s = String(dateValue).trim();
  return s || "";
}

function writeSaulJobRow(target, rowNum, njRow, triple) {
  target
    .getRange(rowNum, SAUL_URL_COL, 1, SAUL_SYNC_NUM_COLS)
    .setValues([triple]);
  target.getRange(rowNum, SAUL_META_COL).setValue(njRow);
}

/** Single batch delete — faster than deleting row-by-row */
function deleteAllSaulDataRows(target) {
  var last = target.getLastRow();
  if (last < SAUL_DATA_START_ROW) return;
  target.deleteRows(SAUL_DATA_START_ROW, last - SAUL_DATA_START_ROW + 1);
}

function reorderSaulRowsToMatchNewJobsOrder(spreadsheet, target, orderedNjRows, desired) {
  var nWant = orderedNjRows.length;
  if (nWant === 0) {
    deleteAllSaulDataRows(target);
    return;
  }

  var lastCol = Math.max(target.getLastColumn(), SAUL_META_COL, SAUL_TYPE_COL);
  var tLast = target.getLastRow();
  var njToFullRow = new Map();

  if (tLast >= SAUL_DATA_START_ROW) {
    var numExisting = tLast - SAUL_DATA_START_ROW + 1;
    var block = target
      .getRange(SAUL_DATA_START_ROW, 1, numExisting, lastCol)
      .getValues();
    for (var i = 0; i < block.length; i++) {
      var rowArr = block[i].slice();
      while (rowArr.length < lastCol) rowArr.push("");
      var metaNj = parseMetaNjRow(rowArr[SAUL_META_COL - 1]);
      if (!isNaN(metaNj) && metaNj > 0) {
        njToFullRow.set(metaNj, rowArr);
      }
    }
  }

  var out = [];
  var perDateCounter = new Map();
  var tz = spreadsheet.getSpreadsheetTimeZone();
  for (var p = 0; p < nWant; p++) {
    var nj = orderedNjRows[p];
    var trip = desired.get(nj);
    var rowOut = njToFullRow.has(nj)
      ? njToFullRow.get(nj).slice()
      : [];
    while (rowOut.length < lastCol) rowOut.push("");
    var dateValue = preserveSaulDateOrSetToday(
      spreadsheet,
      trip[0],
      rowOut[SAUL_DATE_COL - 1]
    );
    rowOut[SAUL_DATE_COL - 1] = dateValue;
    var dateKey = dateKeyForSaulCounter(dateValue, tz);
    if (dateKey) {
      var nForDate = (perDateCounter.get(dateKey) || 0) + 1;
      perDateCounter.set(dateKey, nForDate);
      rowOut[SAUL_NO_COL - 1] = nForDate;
    } else {
      rowOut[SAUL_NO_COL - 1] = "";
    }
    rowOut[SAUL_URL_COL - 1] = trip[0];
    rowOut[SAUL_COMPANY_COL - 1] = trip[1];
    rowOut[SAUL_TYPE_COL - 1] = trip[2];
    rowOut[SAUL_META_COL - 1] = nj;
    out.push(rowOut);
  }

  target.getRange(SAUL_DATA_START_ROW, 1, out.length, lastCol).setValues(out);

  var wantLast = SAUL_DATA_START_ROW + nWant - 1;
  var curLast = target.getLastRow();
  while (curLast > wantLast) {
    target.deleteRow(curLast);
    curLast = target.getLastRow();
  }
}

function buildDesiredFromNewJobs(srcData, srcRichUrls, allowedTypesSet, options) {
  options = options || {};
  var allowUsableForSaul = options.allowUsableForSaulStatus === true;
  var desired = new Map();
  var orderedNjRows = [];
  var seenUrlKeys = new Set();
  var seenCompanyKeys = new Set();
  for (var i = NJ_HEADER_ROWS; i < srcData.length; i++) {
    var njRow = i + 1;
    var row = srcData[i];
    var status = String(row[NJ_STATUS_COL] || "")
      .toLowerCase()
      .trim();
    var typeNorm = normalizeTypeForFilter(row[NJ_TYPE_COL]);
    var jobUrl = getCanonicalJobUrl(srcRichUrls[i][0], row[NJ_JOB_URL_COL]);
    var statusOk =
      status === "usable" ||
      (allowUsableForSaul && status === "usable_for_saul");
    if (!jobUrl || !statusOk || !allowedTypesSet.has(typeNorm)) continue;
    var urlKey = normalizeJobUrlForDedupe(jobUrl);
    if (!urlKey || seenUrlKeys.has(urlKey)) continue;
    var companyKey = normalizeCompanyForDedupe(row[NJ_COMPANY_COL]);
    var isCompanyDuplicate =
      DEDUPE_BY_COMPANY_ON_NEW_JOBS &&
      companyKey &&
      seenCompanyKeys.has(companyKey);
    if (isCompanyDuplicate) {
      Logger.log(
        "company-overlap allowed: new_jobs row " +
          njRow +
          ", company=" +
          companyKey +
          ", url=" +
          jobUrl
      );
    }
    seenUrlKeys.add(urlKey);
    if (companyKey) seenCompanyKeys.add(companyKey);
    desired.set(njRow, [jobUrl, row[NJ_COMPANY_COL], row[NJ_TYPE_COL]]);
    orderedNjRows.push(njRow);
  }
  return { desired: desired, orderedNjRows: orderedNjRows };
}

/**
 * Mark duplicate candidates in new_jobs status column so overlap reason is visible.
 * Only rows with usable/usable_for_saul + valid type + URL are considered.
 */
function markOverlappedStatusesOnNewJobs(sourceSheet, srcData, srcRichUrls) {
  var seenCompanyKeys = new Set();
  var updates = [];

  for (var i = NJ_HEADER_ROWS; i < srcData.length; i++) {
    var row = srcData[i];
    var rowNum = i + 1;
    var status = String(row[NJ_STATUS_COL] || "")
      .toLowerCase()
      .trim();
    var typeNorm = normalizeTypeForFilter(row[NJ_TYPE_COL]);
    var jobUrl = getCanonicalJobUrl(srcRichUrls[i][0], row[NJ_JOB_URL_COL]);
    var statusEligible =
      status === "usable" ||
      status === "usable_for_saul" ||
      status === "company overlapped";
    if (!statusEligible || !jobUrl || !ALL_ALLOWED_TYPES_SET.has(typeNorm)) continue;

    var companyKey = normalizeCompanyForDedupe(row[NJ_COMPANY_COL]);
    if (
      DEDUPE_BY_COMPANY_ON_NEW_JOBS &&
      companyKey &&
      seenCompanyKeys.has(companyKey)
    ) {
      updates.push({ rowNum: rowNum, status: "company overlapped" });
      continue;
    }

    if (companyKey) seenCompanyKeys.add(companyKey);
  }

  for (var u = 0; u < updates.length; u++) {
    var up = updates[u];
    sourceSheet.getRange(up.rowNum, NJ_STATUS_COL_1_BASED).setValue(up.status);
    srcData[up.rowNum - 1][NJ_STATUS_COL] = up.status;
  }
}

function syncOneTargetSheet(spreadsheet, target, desired, orderedNjRows) {
  var tLastRow = target.getLastRow();
  var oldByNjRow = new Map();
  var legacyRows = [];

  if (tLastRow >= SAUL_DATA_START_ROW) {
    var numDataRows = tLastRow - SAUL_DATA_START_ROW + 1;
    var oldVals = target
      .getRange(
        SAUL_DATA_START_ROW,
        SAUL_URL_COL,
        numDataRows,
        SAUL_SYNC_NUM_COLS
      )
      .getValues();
    var oldRichUrls = target
      .getRange(SAUL_DATA_START_ROW, SAUL_URL_COL, numDataRows, 1)
      .getRichTextValues();
    var metaVals = target
      .getRange(SAUL_DATA_START_ROW, SAUL_META_COL, numDataRows, 1)
      .getValues();

    for (var j = 0; j < oldVals.length; j++) {
      var rowNum = SAUL_DATA_START_ROW + j;
      var url = getCanonicalJobUrl(oldRichUrls[j][0], oldVals[j][0]);
      var metaNj = parseMetaNjRow(metaVals[j][0]);
      var vals3 = [url, oldVals[j][1], oldVals[j][2]];

      if (!isNaN(metaNj) && metaNj > 0 && desired.has(metaNj)) {
        oldByNjRow.set(metaNj, { rowNum: rowNum, values: vals3 });
      } else if (url) {
        legacyRows.push({ rowNum: rowNum, values: vals3 });
      }
    }
  }

  var claimedNj = new Set(oldByNjRow.keys());
  var unmatchedDesiredNj = [];
  desired.forEach(function (_v, nj) {
    if (!claimedNj.has(nj)) unmatchedDesiredNj.push(nj);
  });
  unmatchedDesiredNj.sort(function (a, b) {
    return a - b;
  });
  legacyRows.sort(function (a, b) {
    return a.rowNum - b.rowNum;
  });

  var pairN = Math.min(legacyRows.length, unmatchedDesiredNj.length);
  for (var p = 0; p < pairN; p++) {
    var nj = unmatchedDesiredNj[p];
    var leg = legacyRows[p];
    var tripleP = desired.get(nj);
    writeSaulJobRow(target, leg.rowNum, nj, tripleP);
    target.getRange(leg.rowNum, SAUL_DATE_COL).setValue("");
    oldByNjRow.set(nj, { rowNum: leg.rowNum, values: tripleP });
    claimedNj.add(nj);
  }

  var legacyToDelete = legacyRows.slice(pairN);
  var njToAppend = unmatchedDesiredNj.slice(pairN);

  var deleteRowNums = [];
  var r;
  for (r = 0; r < legacyToDelete.length; r++) {
    deleteRowNums.push(legacyToDelete[r].rowNum);
  }

  oldByNjRow.forEach(function (entry, nj) {
    if (!desired.has(nj)) deleteRowNums.push(entry.rowNum);
  });

  deleteRowNums.sort(function (a, b) {
    return b - a;
  });
  var seenDel = new Set();
  for (r = 0; r < deleteRowNums.length; r++) {
    var dr = deleteRowNums[r];
    if (seenDel.has(dr)) continue;
    seenDel.add(dr);
    target.deleteRow(dr);
  }

  oldByNjRow = new Map();
  tLastRow = target.getLastRow();
  if (tLastRow >= SAUL_DATA_START_ROW) {
    numDataRows = tLastRow - SAUL_DATA_START_ROW + 1;
    oldVals = target
      .getRange(
        SAUL_DATA_START_ROW,
        SAUL_URL_COL,
        numDataRows,
        SAUL_SYNC_NUM_COLS
      )
      .getValues();
    oldRichUrls = target
      .getRange(SAUL_DATA_START_ROW, SAUL_URL_COL, numDataRows, 1)
      .getRichTextValues();
    metaVals = target
      .getRange(SAUL_DATA_START_ROW, SAUL_META_COL, numDataRows, 1)
      .getValues();

    for (var j2 = 0; j2 < oldVals.length; j2++) {
      var rowNum2 = SAUL_DATA_START_ROW + j2;
      var url2 = getCanonicalJobUrl(oldRichUrls[j2][0], oldVals[j2][0]);
      var metaNj2 = parseMetaNjRow(metaVals[j2][0]);
      var vals32 = [url2, oldVals[j2][1], oldVals[j2][2]];
      if (!isNaN(metaNj2) && metaNj2 > 0 && desired.has(metaNj2)) {
        oldByNjRow.set(metaNj2, { rowNum: rowNum2, values: vals32 });
      }
    }
  }

  desired.forEach(function (newTriple, nj) {
    if (!oldByNjRow.has(nj)) return;
    var oldEntry = oldByNjRow.get(nj);
    if (!tripleEqual(oldEntry.values, newTriple)) {
      writeSaulJobRow(target, oldEntry.rowNum, nj, newTriple);
    } else {
      target.getRange(oldEntry.rowNum, SAUL_META_COL).setValue(nj);
    }
  });

  for (r = 0; r < njToAppend.length; r++) {
    var njAdd = njToAppend[r];
    var startRow = target.getLastRow() + 1;
    writeSaulJobRow(target, startRow, njAdd, desired.get(njAdd));
    target.getRange(startRow, SAUL_DATE_COL).setValue("");
  }

  reorderSaulRowsToMatchNewJobsOrder(
    spreadsheet,
    target,
    orderedNjRows,
    desired
  );
}

function syncAllTeamSheetsFromNewJobs() {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return;
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var source = ss.getSheetByName("new_jobs");
    if (!source) return;

    var srcLastRow = source.getLastRow();
    if (srcLastRow <= NJ_HEADER_ROWS) {
      for (var c = 0; c < TEAM_SHEET_CONFIG.length; c++) {
        var t0 = ss.getSheetByName(TEAM_SHEET_CONFIG[c].sheetName);
        if (t0) deleteAllSaulDataRows(t0);
      }
      return;
    }

    var srcData = source
      .getRange(1, 1, srcLastRow, source.getLastColumn())
      .getValues();
    var srcRichUrls = source.getRange(1, 4, srcLastRow, 1).getRichTextValues();

    syncNewJobsAddedDatesFromSource(ss, source, srcData, srcRichUrls);
    markOverlappedStatusesOnNewJobs(source, srcData, srcRichUrls);

    for (var k = 0; k < TEAM_SHEET_CONFIG.length; k++) {
      var cfg = TEAM_SHEET_CONFIG[k];
      var target = ss.getSheetByName(cfg.sheetName);
      if (!target) {
        Logger.log("sync: missing sheet tab: " + cfg.sheetName);
        continue;
      }
      var built = buildDesiredFromNewJobs(
        srcData,
        srcRichUrls,
        cfg.allowedTypes,
        { allowUsableForSaulStatus: cfg.allowUsableForSaulStatus === true }
      );
      syncOneTargetSheet(ss, target, built.desired, built.orderedNjRows);
    }
  } finally {
    lock.releaseLock();
  }
}

/** Manual edits on new_jobs; column D updates stamp A when URL first appears. Use a time trigger for API/pipeline updates. */
function onEdit(e) {
  try {
    if (!e || !e.range || !e.source) return;
    if (e.range.getSheet().getName() !== "new_jobs") return;
    var sheet = e.range.getSheet();
    var ss = e.source;
    var urlCol1Based = NJ_JOB_URL_COL + 1;
    if (rangeIntersectsColumn1Based(e.range, urlCol1Based)) {
      var r0 = e.range.getRow();
      var nr = e.range.getNumRows();
      for (var i = 0; i < nr; i++) {
        syncNewJobsAddedDateColumnForRow(ss, sheet, r0 + i);
      }
    }
    var col = e.range.getColumn();
    if (col >= NJ_EDIT_COL_MIN && col <= NJ_EDIT_COL_MAX) {
      syncAllTeamSheetsFromNewJobs();
    }
  } catch (err) {
    Logger.log("onEdit: " + err);
  }
}

function runSyncAllTeamSheetsNow() {
  syncAllTeamSheetsFromNewJobs();
}
