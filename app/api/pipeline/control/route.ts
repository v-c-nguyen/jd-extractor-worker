import { NextResponse } from "next/server";
import { join } from "node:path";
import { spawnTsxScript } from "@/lib/pipeline-spawn";
import {
  assignPipelineChild,
  flushStreamCarries,
  isPipelineRunning,
  pushSystemLog,
  releasePipelineChildIfCurrent,
  stopAssignedPipeline,
  wireChildLogs,
} from "@/lib/pipeline-runtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action as string | undefined;

    if (action === "stop") {
      if (!isPipelineRunning()) {
        return NextResponse.json({ success: true, message: "Pipeline was not running" });
      }
      pushSystemLog("Stop requested");
      stopAssignedPipeline();
      return NextResponse.json({ success: true, message: "Pipeline stopped" });
    }

    if (action === "run_once") {
      const projectRoot = process.cwd();
      const scriptPath = join(projectRoot, "src", "pipeline-one-cycle.ts");
      pushSystemLog("Running one cycle (pipeline-one-cycle.ts)…");
      const child = spawnTsxScript(projectRoot, scriptPath, { stdio: "pipe" });
      wireChildLogs(child);
      assignPipelineChild(child);
      let stderr = "";
      let stdout = "";
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      try {
        await new Promise<void>((resolve, reject) => {
          child.on("close", (code, signal) => {
            flushStreamCarries();
            releasePipelineChildIfCurrent(child);
            if (signal === "SIGTERM" || signal === "SIGKILL") {
              pushSystemLog("One cycle stopped");
              reject(new Error("Run one cycle was stopped"));
              return;
            }
            if (code === 0) {
              pushSystemLog("One cycle completed");
              resolve();
            } else {
              pushSystemLog(`One cycle exited with code ${code}`);
              reject(new Error(stderr || stdout || `Exit code ${code}`));
            }
          });
          child.on("error", (err) => {
            releasePipelineChildIfCurrent(child);
            reject(err);
          });
        });
        return NextResponse.json({ success: true, message: "One cycle completed" });
      } catch (err) {
        releasePipelineChildIfCurrent(child);
        throw err;
      }
    }

    if (action === "start") {
      if (isPipelineRunning()) {
        return NextResponse.json(
          { success: false, message: "Pipeline is already running" },
          { status: 400 }
        );
      }
      const projectRoot = process.cwd();
      const scriptPath = join(projectRoot, "src", "pipeline.ts");
      pushSystemLog("Starting continuous pipeline (pipeline.ts)…");
      const child = spawnTsxScript(projectRoot, scriptPath, { stdio: "pipe" });
      wireChildLogs(child);
      assignPipelineChild(child);
      child.on("error", (err) => {
        console.error("[pipeline] child error:", err);
        pushSystemLog(`Child error: ${err.message}`);
        releasePipelineChildIfCurrent(child);
      });
      child.on("close", (code, signal) => {
        flushStreamCarries();
        if (code != null && code !== 0) {
          console.error("[pipeline] child exited with code", code, "signal", signal);
          pushSystemLog(`Pipeline exited (code ${code}${signal ? `, signal ${signal}` : ""})`);
        } else {
          pushSystemLog("Pipeline process ended");
        }
        releasePipelineChildIfCurrent(child);
      });
      return NextResponse.json({ success: true, message: "Pipeline started" });
    }

    return NextResponse.json(
      { success: false, message: "Invalid action. Use start, stop, or run_once" },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
