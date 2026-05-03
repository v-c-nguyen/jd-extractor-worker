import OpenAI from "openai";
import {
  JobExtractionSchema,
  postProcessExtraction,
  JSON_SCHEMA_FOR_OPENAI,
  type JobExtraction,
} from "./schema.js";

/** Max JD characters sent to the API. Lower = faster and cheaper. Override with OPENAI_JD_MAX_CHARS. */
const DEFAULT_MAX_JD_CHARS = 12_000;

function getMaxJdChars(): number {
  const env = process.env.OPENAI_JD_MAX_CHARS;
  if (env == null || env === "") return DEFAULT_MAX_JD_CHARS;
  const n = parseInt(env, 10);
  return Number.isNaN(n) || n < 1000 ? DEFAULT_MAX_JD_CHARS : Math.min(n, 50_000);
}

const SYSTEM_PROMPT = `Extract job fields from a JD into the required JSON schema.

Rules:
- Use only explicit evidence from the JD for all fields except industry fallback.
- If unknown: return null (or "Not mentioned" for enum fields that require it).
- Keep values short and canonical.
- Salary must be numeric only (no currency symbols or commas).

Field guidance:
- location: US-only flag -> "yes" or "no"; null if unclear.
- industry: choose exactly one (exact string):
  "Software/SaaS", "Cybersecurity", "AI/ML", "IT Services", "Telecom", "E-commerce", "Retail", "Consumer Electronics", "Ad/MarTech", "Media/News/Publishing", "Gaming", "Banking/Financial Services", "Fintech", "Insurance", "Investment/Asset Mgmt", "Professional Services", "Healthcare Providers", "HealthTech", "Biotech/Pharma", "Med Devices/Equipment", "Manufacturing", "Automotive/Mobility", "Aerospace/Defense", "Energy/Utilities", "Construction/Engineering", "Logistics/Transportation", "Supply Chain/Ops Tech", "Travel/Hospitality", "Real Estate", "PropTech", "Government/Public Sector", "Education/EdTech", "Non-Profit/NGO", "Security (Physical/National)".
- industry fallback: if the JD does not clearly state the industry, analyze the company's likely industry using company name, business description, products/services, customer type, domain cues in the URL, and any context in the JD. Then choose the single best-matching category from the allowed list above. Do not leave industry null when a best-fit category can be reasonably inferred.
- work_mode: one of "Fully Remote", "Open to Remote", "Hybrid", "Onsite", "Not mentioned".
- travel: use "%", "occasional", "not required", or "not mentioned"; null only if truly unknown.
- clearance_required: "yes" if security clearance is required, else "no", null if unclear.
- government_agency: "yes" if employer is government or role clearly supports a named government agency; else "no"; null if unclear.
- type: choose exactly one allowed type; prefer the single best fit.
- seniority: choose one of "Staff", "Lead", "Principal", "Senior", "Normal"; use "Normal" when level is not explicit but role is otherwise standard.
`;

function buildUserPrompt(jdText: string, jobUrl: string): string {
  return `URL: ${jobUrl}
JD:
${jdText}`;
}

/** Token usage as returned by the OpenAI API. */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export async function extractJobFields(
  jdText: string,
  jobUrl: string
): Promise<{ extraction: JobExtraction; usage: TokenUsage }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const maxChars = getMaxJdChars();
  const truncatedText =
    jdText.length > maxChars ? jdText.slice(0, maxChars) : jdText;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(truncatedText, jobUrl) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: JSON_SCHEMA_FOR_OPENAI,
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const usage: TokenUsage = {
    prompt_tokens: response.usage?.prompt_tokens ?? 0,
    completion_tokens: response.usage?.completion_tokens ?? 0,
    total_tokens: response.usage?.total_tokens ?? 0,
  };

  const parsed = JSON.parse(content) as unknown;
  const validated = JobExtractionSchema.parse(parsed);
  const extraction = postProcessExtraction(validated);
  return { extraction, usage };
}
