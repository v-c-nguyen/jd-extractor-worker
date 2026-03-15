import { JSDOM } from "jsdom";

const CONTAINER_SELECTORS = ["#content", "#app_body", "main"];

const REMOVE_SELECTORS = [
  "#application",
  "form",
  "#apply_button",
  ".application",
  ".application--fields",
  "#eeo_fields",
  "[id*='eeo']",
  "[class*='eeo']",
  "[id*='veteran']",
  "[id*='disability']",
  "script",
  "style",
  "nav",
  "footer",
  "header",
];

const TRUNCATE_MARKERS = [
  "create a job alert",
  "interested in building your career",
  "get future opportunities sent straight to your email",
  "create alert",
  "apply for this job",
  "*indicates a required field",
  "autofill with mygreenhouse",
  "mygreenhouse",
];

const HEADER_CLEANUP_PATTERNS = [
  /^back to jobs\s*/i,
];

function removeNodes(doc: Document, selectors: string[]): void {
  for (const selector of selectors) {
    const nodes = doc.querySelectorAll(selector);
    nodes.forEach((node) => node.remove());
  }
}

function truncateAtGreenhouseMarkers(text: string): string {
  const lower = text.toLowerCase();
  let cutIndex = -1;

  for (const marker of TRUNCATE_MARKERS) {
    const idx = lower.indexOf(marker);
    if (idx !== -1 && (cutIndex === -1 || idx < cutIndex)) {
      cutIndex = idx;
    }
  }

  if (cutIndex !== -1) {
    return text.slice(0, cutIndex);
  }
  return text;
}

function cleanGreenhouseHeader(text: string): string {
  let result = text;

  for (const pattern of HEADER_CLEANUP_PATTERNS) {
    result = result.replace(pattern, "");
  }

  const head = result.slice(0, 200);
  const applyMatch = head.match(/^(\s*Apply\s+)/i);
  if (applyMatch) {
    result = result.slice(applyMatch[0].length);
  }

  return result;
}

function normalizeGreenhouseWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface GreenhouseCleanResult {
  text: string;
  beforeLen: number;
  afterLen: number;
}

export function cleanGreenhouseText(rawText: string): GreenhouseCleanResult {
  const beforeLen = rawText.length;
  let text = rawText;

  text = cleanGreenhouseHeader(text);
  text = truncateAtGreenhouseMarkers(text);
  text = normalizeGreenhouseWhitespace(text);

  return {
    text,
    beforeLen,
    afterLen: text.length,
  };
}

export function extractGreenhouseJobDescriptionFromHtml(html: string): string {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  let container: Element | null = null;
  for (const selector of CONTAINER_SELECTORS) {
    container = doc.querySelector(selector);
    if (container) break;
  }

  if (!container) {
    container = doc.body;
  }

  removeNodes(doc, REMOVE_SELECTORS);

  const rawText = (container as HTMLElement).textContent ?? "";
  const { text } = cleanGreenhouseText(rawText);
  return text;
}

export function getGreenhouseRemoveScript(): string {
  const selectors = REMOVE_SELECTORS.map((s) => JSON.stringify(s)).join(", ");
  return `
    (function() {
      const removeSelectors = [${selectors}];
      for (const sel of removeSelectors) {
        document.querySelectorAll(sel).forEach(n => n.remove());
      }
      const containerSelectors = ["#content", "#app_body", "main"];
      let container = null;
      for (const sel of containerSelectors) {
        container = document.querySelector(sel);
        if (container) break;
      }
      if (!container) container = document.body;
      return container.innerText || "";
    })()
  `;
}
