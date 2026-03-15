export function parseRetryCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.floor(value);
    return n < 0 ? 0 : n;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n)) return 0;
    return n < 0 ? 0 : n;
  }

  return 0;
}

export function computeNextRetryAt(retryCount: number): string {
  const now = new Date();

  let delayMs: number;
  if (retryCount <= 1) {
    // retry 1 => now + 5 minutes
    delayMs = 5 * 60 * 1000;
  } else if (retryCount === 2) {
    // retry 2 => now + 30 minutes
    delayMs = 30 * 60 * 1000;
  } else if (retryCount === 3) {
    // retry 3 => now + 2 hours
    delayMs = 2 * 60 * 60 * 1000;
  } else {
    // retry 4+ => now + 24 hours
    delayMs = 24 * 60 * 60 * 1000;
  }

  return new Date(now.getTime() + delayMs).toISOString();
}

