import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { extractGreenhouseJobDescriptionFromHtml } from "./greenhouse.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Fail fast so we can fall back to Playwright for slow/JS-heavy sites (e.g. iCIMS). */
const FETCH_TIMEOUT_MS = 45_000;

function isGreenhouseUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes("greenhouse.io");
  } catch {
    return false;
  }
}

/**
 * Fetch HTML via HTTP and extract main text using Readability.
 * For Greenhouse URLs, uses custom extraction to exclude application/survey sections.
 * Returns extracted text or empty string on failure.
 */
export async function fetchWithReadability(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    html = await res.text();
  } finally {
    clearTimeout(timeoutId);
  }

  if (isGreenhouseUrl(url)) {
    return extractGreenhouseJobDescriptionFromHtml(html);
  }

  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  const reader = new Readability(document);
  const article = reader.parse();
  const text = article?.textContent?.trim() ?? "";
  return text;
}
