export const MIN_LEN = 800;
const HEAD_SCAN_LEN = 1200;

const STRONG_BLOCK_PHRASES = [
  "verify you are a human",
  "captcha",
  "access denied",
  "request blocked",
  "unusual traffic",
  "robot check",
  "cloudflare",
  "datadome",
  "perimeterx",
  "incapsula",
  "blocked due to",
  "temporarily blocked",
  "forbidden",
];

const WEAK_LOGIN_PHRASES = [
  "sign in",
  "log in",
  "login",
  "join linkedin",
  "create an account",
];

const TRANSIENT_PATTERNS = [
  "timeout",
  "net::",
  "econnreset",
  "429",
  "503",
  "socket",
];

export interface BlockedResult {
  blocked: boolean;
  reason: "strong" | "weak" | null;
}

export function checkBlocked(text: string): BlockedResult {
  const head = text.slice(0, HEAD_SCAN_LEN).toLowerCase();

  if (STRONG_BLOCK_PHRASES.some((p) => head.includes(p))) {
    return { blocked: true, reason: "strong" };
  }

  if (text.length < HEAD_SCAN_LEN && WEAK_LOGIN_PHRASES.some((p) => head.includes(p))) {
    return { blocked: true, reason: "weak" };
  }

  return { blocked: false, reason: null };
}

export function isBlockedText(text: string): boolean {
  const result = checkBlocked(text);
  if (!result.blocked) return false;
  if (result.reason === "strong") return true;
  if (result.reason === "weak" && text.length < MIN_LEN) return true;
  return false;
}

export function getBlockedMessage(text: string): string {
  const result = checkBlocked(text);
  if (result.reason === "strong") return "Blocked/captcha";
  if (result.reason === "weak") return "Login required";
  return "Blocked";
}

export function isTooShort(text: string): boolean {
  return text.length < MIN_LEN;
}

export function classifyError(errMsg: string): "retry" | "failed" {
  const lower = errMsg.toLowerCase();
  if (TRANSIENT_PATTERNS.some((p) => lower.includes(p))) {
    return "retry";
  }
  return "failed";
}
