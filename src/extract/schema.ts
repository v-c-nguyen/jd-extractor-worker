import { z } from "zod";

export const WorkModeEnum = z.enum([
  "Fully Remote",
  "Open to Remote",
  "Hybrid",
  "Onsite",
  "Not mentioned",
]);

export const SalaryPeriodEnum = z.enum([
  "year",
  "hour",
  "month",
  "week",
  "day",
  "Not mentioned",
]);

/** Whether the job location is in the US: "yes" or "no". */
export const LocationUSEnum = z.enum(["yes", "no"]);

/** Yes/no for clearance required or government agency. */
export const YesNoEnum = z.enum(["yes", "no"]);

/** Industry category; choose one. */
export const IndustryEnum = z.enum([
  "healthcare",
  "finance",
  "bank",
  "security",
  "ecommerce",
  "edtech",
  "adtech",
  "media or streaming",
  "other",
]);

/** Job type / role category; choose the best match from the list. */
export const JobTypeEnum = z.enum([
  "AI Integration - Full Stack",
  "Applied AI & Automation",
  "AI Product",
  "AI & ML",
  "FullStack - JS",
  "FullStack - Python",
  "FullStack - C#",
  "FullStack - Ruby",
  "FullStack - Go",
  "FullStack - Java",
  "FullStack - PHP",
  "QA",
  "Tech Support or Solutions",
]);

/** Seniority level; choose the best match from the list. */
export const SeniorityEnum = z.enum([
  "Staff",
  "Lead",
  "Principal",
  "Senior",
  "Normal",
]);

export const JobExtractionSchema = z.object({
  company_name: z.string().nullable(),
  role_title: z.string().nullable(),
  work_mode: WorkModeEnum,
  location: LocationUSEnum.nullable(),
  industry: IndustryEnum.nullable(),
  travel: z.string().nullable(),
  clearance_required: YesNoEnum.nullable(),
  government_agency: YesNoEnum.nullable(),
  type: JobTypeEnum.nullable(),
  seniority: SeniorityEnum.nullable(),
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  currency: z.string().nullable(),
  salary_period: SalaryPeriodEnum,
});

export type JobExtraction = z.infer<typeof JobExtractionSchema>;

export function postProcessExtraction(obj: JobExtraction): JobExtraction {
  const trimStr = (s: string | null): string | null => {
    if (s === null) return null;
    const trimmed = s.trim();
    return trimmed || null;
  };

  return {
    company_name: trimStr(obj.company_name),
    role_title: trimStr(obj.role_title),
    work_mode: obj.work_mode,
    location: obj.location,
    industry: obj.industry,
    travel: trimStr(obj.travel),
    clearance_required: obj.clearance_required,
    government_agency: obj.government_agency,
    type: obj.type,
    seniority: obj.seniority,
    salary_min: obj.salary_min,
    salary_max: obj.salary_max,
    currency: trimStr(obj.currency),
    salary_period: obj.salary_period,
  };
}

export const JSON_SCHEMA_FOR_OPENAI = {
  name: "job_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      company_name: { type: ["string", "null"] },
      role_title: { type: ["string", "null"] },
      work_mode: {
        type: "string",
        enum: ["Fully Remote", "Open to Remote", "Hybrid", "Onsite", "Not mentioned"],
      },
      travel: { type: ["string", "null"] },
      clearance_required: {
        type: ["string", "null"],
        enum: ["yes", "no", null],
      },
      government_agency: {
        type: ["string", "null"],
        enum: ["yes", "no", null],
      },
      type: {
        type: ["string", "null"],
        enum: [
          "AI Integration - Full Stack",
          "Applied AI & Automation",
          "AI Product",
          "AI & ML",
          "FullStack - JS",
          "FullStack - Python",
          "FullStack - C#",
          "FullStack - Ruby",
          "FullStack - Go",
          "FullStack - Java",
          "FullStack - PHP",
          "QA",
          "Tech Support or Solutions",
          null,
        ],
      },
      seniority: {
        type: ["string", "null"],
        enum: ["Staff", "Lead", "Principal", "Senior", "Normal", null],
      },
      location: {
        type: ["string", "null"],
        enum: ["yes", "no", null],
      },
      industry: {
        type: ["string", "null"],
        enum: [
          "healthcare",
          "finance",
          "bank",
          "security",
          "ecommerce",
          "edtech",
          "adtech",
          "media or streaming",
          "other",
          null,
        ],
      },
      salary_min: { type: ["number", "null"] },
      salary_max: { type: ["number", "null"] },
      currency: { type: ["string", "null"] },
      salary_period: {
        type: "string",
        enum: ["year", "hour", "month", "week", "day", "Not mentioned"],
      },
    },
    required: [
      "company_name",
      "role_title",
      "work_mode",
      "location",
      "industry",
      "travel",
      "clearance_required",
      "government_agency",
      "type",
      "seniority",
      "salary_min",
      "salary_max",
      "currency",
      "salary_period",
    ],
    additionalProperties: false,
  },
};
