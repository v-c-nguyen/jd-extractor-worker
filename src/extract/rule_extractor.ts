import type { JobExtraction } from "./schema.js";
import type { z } from "zod";
import { SalaryPeriodEnum } from "./schema.js";

/** Partial extraction from rules only. Only fields we extract by rules are present. */
export type RuleExtraction = Partial<
  Pick<
    JobExtraction,
    | "salary_min"
    | "salary_max"
    | "currency"
    | "salary_period"
    | "clearance_required"
    | "government_agency"
    | "location"
    | "travel"
  >
>;

/** Field names that were detected by rules (for logging). */
export type RuleDetectedField =
  | "salary"
  | "clearance_required"
  | "government_agency"
  | "location"
  | "travel";

export interface RuleExtractionResult {
  extraction: RuleExtraction;
  detected: RuleDetectedField[];
}

type SalaryPeriod = z.infer<typeof SalaryPeriodEnum>;

function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").toLowerCase();
}

// ----- Salary -----
const CURRENCY_SYMBOLS: Record<string, string> = {
  $: "USD",
  "usd": "USD",
  "£": "GBP",
  "gbp": "GBP",
  "€": "EUR",
  "eur": "EUR",
};

/** Match $120k-$180k, $120,000 - $180,000, $100k, £50k, etc. */
const SALARY_RANGE =
  /(?:[\$£€]|usd|gbp|eur)\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|K)?(?:\s*[-–—to]+\s*|\s*-\s*)(?:[\$£€]|usd|gbp|eur)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|K)?/i;
const SALARY_SINGLE = /(?:[\$£€]|usd|gbp|eur)\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|K)?/i;
const PERIOD_YEAR = /\b(?:per\s+year|annual(?:ly)?|yearly|\/yr\.?|a\s*year)\b/i;
const PERIOD_HOUR = /\b(?:per\s+hour|hourly|\/hr\.?|an?\s+hour)\b/i;
const PERIOD_MONTH = /\b(?:per\s+month|monthly|\/mo\.?)\b/i;
const PERIOD_WEEK = /\b(?:per\s+week|weekly|\/wk\.?)\b/i;
const PERIOD_DAY = /\b(?:per\s+day|daily|\/day)\b/i;

function parseNum(s: string, hasK: boolean): number {
  const n = parseFloat(s.replace(/,/g, ""));
  return hasK ? n * 1000 : n;
}

function extractSalary(text: string): RuleExtraction["salary_min"] extends infer T
  ? { salary_min: number | null; salary_max: number | null; currency: string | null; salary_period: SalaryPeriod }
  : never {
  const norm = normalizeText(text);
  let salary_min: number | null = null;
  let salary_max: number | null = null;
  let currency: string | null = null;
  let salary_period: SalaryPeriod = "Not mentioned";

  // Detect currency from first symbol or word
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(sym) || norm.includes(code)) {
      currency = code;
      break;
    }
  }
  if (!currency && (text.includes("$") || norm.includes("dollar"))) currency = "USD";

  // Period
  if (PERIOD_YEAR.test(text)) salary_period = "year";
  else if (PERIOD_HOUR.test(text)) salary_period = "hour";
  else if (PERIOD_MONTH.test(text)) salary_period = "month";
  else if (PERIOD_WEEK.test(text)) salary_period = "week";
  else if (PERIOD_DAY.test(text)) salary_period = "day";

  // Range
  const rangeMatch = text.match(SALARY_RANGE);
  if (rangeMatch) {
    const k1 = !!rangeMatch[2];
    const k2 = !!rangeMatch[4];
    salary_min = parseNum(rangeMatch[1] ?? "", k1);
    salary_max = parseNum(rangeMatch[3] ?? "", k2);
    if (salary_min > salary_max) [salary_min, salary_max] = [salary_max, salary_min];
  } else {
    const singleMatch = text.match(SALARY_SINGLE);
    if (singleMatch) {
      const k = !!singleMatch[2];
      salary_min = salary_max = parseNum(singleMatch[1] ?? "", k);
    }
  }

  return { salary_min, salary_max, currency, salary_period } as {
    salary_min: number | null;
    salary_max: number | null;
    currency: string | null;
    salary_period: SalaryPeriod;
  };
}

// ----- Clearance -----
const CLEARANCE =
  /\b(security\s+clearance|clearance\s+required|secret\s+clearance|top\s+secret|ts\/sci|ts-sci|must\s+have\s+clearance|active\s+clearance)\b/i;

function extractClearanceRequired(text: string): "yes" | "no" | null {
  if (CLEARANCE.test(text)) return "yes";
  return null;
}

// ----- Government agency -----
const GOVERNMENT =
  /\b(government|federal|state\s+agency|dod|department\s+of\s+defense|gsa|public\s+sector|government\s+contractor|government\s+agency)\b/i;

function extractGovernmentAgency(text: string): "yes" | "no" | null {
  if (GOVERNMENT.test(text)) return "yes";
  return null;
}

// ----- Location (US yes/no) -----
const US_LOCATION =
  /\b(united\s+states|u\.?\s*s\.?a\.?|usa|u\.?\s*s\.?|remote\s*[-–]\s*us|based\s+in\s+the\s+us)\b/i;
const NON_US = /\b(uk|u\.?\s*k\.?|united\s+kingdom|london|canada|toronto|emea|europe|australia|india)\b/i;

function extractLocation(text: string): "yes" | "no" | null {
  if (US_LOCATION.test(text)) return "yes";
  if (NON_US.test(text)) return "no";
  return null;
}

// ----- Travel -----
const TRAVEL_PCT = /(\d{1,3})\s*%\s*travel|travel\s*[:\s]*\s*(\d{1,3})\s*%/i;
const TRAVEL_OCCASIONAL = /\b(occasional\s+travel|minimal\s+travel|some\s+travel)\b/i;
const TRAVEL_NONE = /\b(no\s+travel|travel\s+not\s+required|zero\s+travel)\b/i;

function extractTravel(text: string): string | null {
  const pctMatch = text.match(TRAVEL_PCT);
  if (pctMatch) {
    const pct = pctMatch[1] ?? pctMatch[2];
    if (pct) return `${pct}%`;
  }
  if (TRAVEL_OCCASIONAL.test(text)) return "occasional";
  if (TRAVEL_NONE.test(text)) return "not required";
  return null;
}

// ----- Public API -----

export function extractWithRules(jdText: string): RuleExtractionResult {
  const extraction: RuleExtraction = {};
  const detected: RuleDetectedField[] = [];

  const salary = extractSalary(jdText);
  const hasSalaryNums =
    salary.salary_min != null || salary.salary_max != null;
  if (hasSalaryNums) {
    extraction.salary_min = salary.salary_min;
    extraction.salary_max = salary.salary_max;
    if (salary.currency != null) extraction.currency = salary.currency;
    if (salary.salary_period !== "Not mentioned")
      extraction.salary_period = salary.salary_period;
    detected.push("salary");
  }

  const clearance_required = extractClearanceRequired(jdText);
  if (clearance_required != null) {
    extraction.clearance_required = clearance_required;
    detected.push("clearance_required");
  }

  const government_agency = extractGovernmentAgency(jdText);
  if (government_agency != null) {
    extraction.government_agency = government_agency;
    detected.push("government_agency");
  }

  const location = extractLocation(jdText);
  if (location != null) {
    extraction.location = location;
    detected.push("location");
  }

  const travel = extractTravel(jdText);
  if (travel != null) {
    extraction.travel = travel;
    detected.push("travel");
  }

  return { extraction, detected };
}

/** Merge rule extraction into OpenAI extraction. Rule values override when present. */
export function mergeRuleIntoExtraction(
  openAI: JobExtraction,
  rule: RuleExtraction
): JobExtraction {
  return {
    ...openAI,
    ...(rule.salary_min !== undefined && { salary_min: rule.salary_min }),
    ...(rule.salary_max !== undefined && { salary_max: rule.salary_max }),
    ...(rule.currency !== undefined && { currency: rule.currency }),
    ...(rule.salary_period !== undefined && { salary_period: rule.salary_period }),
    ...(rule.clearance_required !== undefined && { clearance_required: rule.clearance_required }),
    ...(rule.government_agency !== undefined && { government_agency: rule.government_agency }),
    ...(rule.location !== undefined && { location: rule.location }),
    ...(rule.travel !== undefined && { travel: rule.travel }),
  };
}
