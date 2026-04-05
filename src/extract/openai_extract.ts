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

const SYSTEM_PROMPT = `You are a structured data extractor for job descriptions.

Your task is to extract specific fields from the job description text provided.

Rules:
1. Use ONLY information explicitly present in the job description text.
2. If a field is not mentioned or cannot be determined, return null or "Not mentioned" as appropriate.
3. Prefer concise values (e.g., "San Francisco, CA" not "San Francisco, California, United States of America").
4. For salary, extract numeric values only (e.g., 150000 not "$150,000").

Location: Do NOT extract a specific city or address. Determine only whether the job is in the United States (US) or not. Return "yes" if the job location is in the US, "no" if it is outside the US. Return null only if it cannot be determined.
Industry: Choose exactly ONE value from this list: healthcare, finance, bank, security, ecommerce, edtech, adtech, media or streaming, other. Pick the single best match for the company or role. Use "other" if none of the others fit. Return null only if it cannot be determined.
Work mode: Choose exactly ONE value: "Fully Remote" (fully remote only), "Open to Remote" (remote is an option or flexible), "Hybrid", "Onsite", "Not mentioned". Use "Not mentioned" if unclear.
Travel: Extract travel requirements. Use a specific percentage if stated (e.g. "25%", "50%"), or "occasional" if travel is mentioned but not a percentage, or "not required" if the JD says no travel, or "not mentioned" if not specified. Return null only if it cannot be determined.
Clearance required: If the job requires security clearance (e.g. Secret, Top Secret, etc.), return "yes". Otherwise return "no". Return null only if it cannot be determined.
Government agency: Return "yes" if (a) the employer or company is a government agency (federal, state, or local), OR (b) the job is clearly for or in support of a government agency (e.g. contractor role supporting IRS, DoD, or other government; job or clearance explicitly tied to a named government agency like Internal Revenue Service, Department of Defense, etc.). Otherwise return "no". Return null only if it cannot be determined.
Type: Choose exactly ONE value that best matches the job based on the description: "AI Integration - Full Stack", "Applied AI & Automation", "AI Product", "AI & ML", "FullStack - JS", "FullStack - Python", "FullStack - C#", "FullStack - Ruby", "FullStack - Go", "FullStack - Java", "FullStack - PHP", "DevOps" (infrastructure, CI/CD, platform, SRE, cloud operations roles that are not primarily application full-stack development), "QA", "Tech Support or Solutions". Pick the single best fit (e.g. QA for quality assurance roles, FullStack - X for full-stack with that stack, AI/ML for ML-heavy roles). Return null only if it cannot be determined.
Seniority: Choose exactly ONE value that best matches the job level: "Staff", "Lead", "Principal", "Senior", or "Normal". Use title/level cues (e.g. Senior/Staff/Lead/Principal in the title or requirements). Use "Normal" for mid-level or when no seniority is indicated. Return null only if it cannot be determined.`;

function buildUserPrompt(jdText: string, jobUrl: string): string {
  return `Job URL: ${jobUrl}

Job Description:
${jdText}

Extract the structured data from this job description.`;
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
