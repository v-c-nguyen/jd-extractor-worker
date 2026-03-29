import { execFileSync, type ChildProcess } from "node:child_process";

const MAX_LINES = 4000;

function killProcessTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid == null) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      /* already exited */
    }
    return;
  }
  try {
    child.kill("SIGTERM");
  } catch {
    /* ignore */
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __pipelineChild: ChildProcess | undefined;
  // eslint-disable-next-line no-var
  var __pipelineLogLines: string[] | undefined;
  // eslint-disable-next-line no-var
  var __pipelineStdoutCarry: string | undefined;
  // eslint-disable-next-line no-var
  var __pipelineStderrCarry: string | undefined;
}

function logLines(): string[] {
  if (!globalThis.__pipelineLogLines) {
    globalThis.__pipelineLogLines = [];
  }
  return globalThis.__pipelineLogLines;
}

function carryOut(): string {
  if (globalThis.__pipelineStdoutCarry === undefined) {
    globalThis.__pipelineStdoutCarry = "";
  }
  return globalThis.__pipelineStdoutCarry;
}

function carryErr(): string {
  if (globalThis.__pipelineStderrCarry === undefined) {
    globalThis.__pipelineStderrCarry = "";
  }
  return globalThis.__pipelineStderrCarry;
}

function trimLog(): void {
  const lines = logLines();
  while (lines.length > MAX_LINES) {
    lines.shift();
  }
}

export function pushSystemLog(message: string): void {
  const lines = logLines();
  lines.push(`[sys] ${message}`);
  trimLog();
}

function pushPrefixedLines(prefix: string, text: string): void {
  if (!text) return;
  const lines = logLines();
  for (const line of text.split(/\r?\n/)) {
    lines.push(`${prefix}${line}`);
  }
  trimLog();
}

export function ingestStreamChunk(stream: "stdout" | "stderr", chunk: string): void {
  const isOut = stream === "stdout";
  const prefix = isOut ? "[out] " : "[err] ";
  let buf = (isOut ? carryOut() : carryErr()) + chunk;
  const parts = buf.split(/\r?\n/);
  const incomplete = parts.pop() ?? "";
  if (isOut) {
    globalThis.__pipelineStdoutCarry = incomplete;
  } else {
    globalThis.__pipelineStderrCarry = incomplete;
  }
  pushPrefixedLines(prefix, parts.join("\n"));
}

export function flushStreamCarries(): void {
  const o = carryOut();
  const e = carryErr();
  if (o.length > 0) {
    pushPrefixedLines("[out] ", o);
    globalThis.__pipelineStdoutCarry = "";
  }
  if (e.length > 0) {
    pushPrefixedLines("[err] ", e);
    globalThis.__pipelineStderrCarry = "";
  }
}

export function wireChildLogs(child: ChildProcess): void {
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string | Buffer) => {
    const s = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    ingestStreamChunk("stdout", s);
  });
  child.stderr?.on("data", (chunk: string | Buffer) => {
    const s = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    ingestStreamChunk("stderr", s);
  });
  const onEnd = () => {
    flushStreamCarries();
  };
  child.once("close", onEnd);
  child.once("error", onEnd);
}

/** Full line buffer (bounded by MAX_LINES). Replaced each poll so UI stays in sync after ring trims. */
export function getAllLogLines(): string[] {
  return [...logLines()];
}

export function clearLogs(): void {
  globalThis.__pipelineLogLines = [];
  globalThis.__pipelineStdoutCarry = "";
  globalThis.__pipelineStderrCarry = "";
}

export function assignPipelineChild(child: ChildProcess): void {
  globalThis.__pipelineChild = child;
}

export function releasePipelineChildIfCurrent(child: ChildProcess): void {
  if (globalThis.__pipelineChild === child) {
    globalThis.__pipelineChild = undefined;
  }
}

/** Kill the running pipeline process (and on Windows, its whole subtree) and clear the handle. */
export function stopAssignedPipeline(): boolean {
  const child = globalThis.__pipelineChild;
  if (!child) return false;
  killProcessTree(child);
  globalThis.__pipelineChild = undefined;
  return true;
}

export function isPipelineRunning(): boolean {
  return typeof globalThis.__pipelineChild !== "undefined";
}
