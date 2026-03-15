import { type Browser, type Frame, type Page } from "playwright";
import { getGreenhouseRemoveScript, cleanGreenhouseText, type GreenhouseCleanResult } from "./greenhouse.js";

const PAGE_TIMEOUT_MS = 180_000;
/** How long to wait for body to reach BODY_MIN_LENGTH before extracting anyway. */
const BODY_WAIT_TIMEOUT_MS = 180_000;
const IFRAME_WAIT_MS = 5_000;
/** Wait for at least this many body chars before extracting, so we get job content not just header ("Sign in" / "Login"). */
const BODY_MIN_LENGTH = 800;
const SELECTOR_MIN_LENGTH = 500;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SITE_SELECTORS: Record<string, string[]> = {
  lever: [".posting", ".posting-content"],
  ashby: ["main", "[data-ashby-job-board]", "[data-ashby-job-board-embed]", ".ashby-job-board"],
  workday: ["main"],
  indeed: ["main"],
  ziprecruiter: ["main"],
  jobdiva: ["main", "#mainContent", ".job-description", ".job-details", "article", "[role='main']"],
  icims: ["main", "#main", ".iCIMS_ContentWrapper", ".job-description", "#job-description", "article", "[role='main']"],
};

function isGreenhouseUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes("greenhouse.io");
  } catch {
    return false;
  }
}

/** Sources that render main content with JS or load slowly; need networkidle or extra wait. */
function isSpaLikeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes("ashby") ||
      host.includes("icims") ||
      host.includes("jobdiva") ||
      host.includes("nextdoor") ||
      host.includes("zetaglobal")
    );
  } catch {
    return false;
  }
}

function isAshbyUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes("ashby");
  } catch {
    return false;
  }
}

/** Sites that embed job content in an iframe; we must extract from the frame with most text. */
function isIframeContentUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("ashby") || host.includes("icims");
  } catch {
    return false;
  }
}

/** Content target: page (main frame) or a child frame (e.g. Ashby job board iframe). */
type ContentTarget = Page | Frame;

/** For Ashby/iCIMS, job content is often inside an iframe; return the frame with most body text. */
async function getContentFrame(page: Page, url: string): Promise<ContentTarget> {
  if (!isIframeContentUrl(url)) return page;

  const isIcims = new URL(url).hostname.toLowerCase().includes("icims");
  if (isIcims) {
    const icimsFrameSelector = "#icims_content_iframe";
    try {
      await page.waitForSelector(icimsFrameSelector, { timeout: 15_000 });
      await page.waitForTimeout(3000);
      const frameEl = await page.$(icimsFrameSelector);
      if (frameEl) {
        const frame = await frameEl.contentFrame();
        if (frame) return frame;
      }
    } catch {
      // fall through to generic frame pick
    }
  }

  const frames = page.frames().filter((f) => f !== page.mainFrame());
  if (frames.length === 0) return page;
  await page.waitForTimeout(IFRAME_WAIT_MS);
  let best: ContentTarget = page;
  let bestLen = await page.evaluate(() => document.body?.innerText?.length ?? 0);
  for (const frame of frames) {
    try {
      const len = await frame.evaluate(() => document.body?.innerText?.length ?? 0);
      if (len > bestLen) {
        bestLen = len;
        best = frame;
      }
    } catch {
      // frame may be detached or cross-origin
    }
  }
  return best;
}

function getSiteSelectors(url: string): string[] {
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const [site, selectors] of Object.entries(SITE_SELECTORS)) {
      if (host.includes(site)) return selectors;
    }
  } catch {
    // ignore
  }
  return ["main", "article", "[role='main']"];
}

async function waitForBodyContent(page: Page, target: ContentTarget): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < BODY_WAIT_TIMEOUT_MS) {
    const len = await target.evaluate(() => document.body?.innerText?.length ?? 0);
    if (len >= BODY_MIN_LENGTH) return;
    await page.waitForTimeout(500);
  }
}

async function extractGreenhouseText(page: Page): Promise<GreenhouseCleanResult> {
  const script = getGreenhouseRemoveScript();
  const rawText = await page.evaluate(script);
  return cleanGreenhouseText((rawText as string).trim());
}

export interface PlaywrightExtractResult {
  text: string;
  greenhouseClean?: { beforeLen: number; afterLen: number };
}

async function extractTextFromPage(
  page: Page,
  url: string,
  target: ContentTarget
): Promise<PlaywrightExtractResult> {
  if (isGreenhouseUrl(url)) {
    const result = await extractGreenhouseText(page);
    return {
      text: result.text,
      greenhouseClean: { beforeLen: result.beforeLen, afterLen: result.afterLen },
    };
  }

  const selectors = getSiteSelectors(url);

  for (const selector of selectors) {
    try {
      const el = await target.$(selector);
      if (el) {
        const text = await el.evaluate((node) => (node as HTMLElement).innerText ?? "");
        if (text.trim().length >= SELECTOR_MIN_LENGTH) {
          return { text: text.trim() };
        }
      }
    } catch {
      // selector not found, continue
    }
  }

  const bodyText = await target.evaluate(() => document.body?.innerText ?? "");
  return { text: bodyText.trim() };
}

/**
 * Fetch URL via Playwright (render), then extract text using site-specific selectors or body.
 * Caller must pass a shared browser instance; this function creates and closes a page.
 */
export async function fetchWithPlaywright(
  browser: Browser,
  url: string
): Promise<PlaywrightExtractResult> {
  const page = await browser.newPage({
    userAgent: USER_AGENT,
  });
  try {
    const waitUntil = isSpaLikeUrl(url) ? "networkidle" : "domcontentloaded";
    await page.goto(url, {
      waitUntil,
      timeout: PAGE_TIMEOUT_MS,
    });
    if (isSpaLikeUrl(url)) {
      await page.waitForTimeout(3500);
    }
    const contentTarget = await getContentFrame(page, url);
    await waitForBodyContent(page, contentTarget);
    return await extractTextFromPage(page, url, contentTarget);
  } finally {
    await page.close();
  }
}

export type { Browser };
