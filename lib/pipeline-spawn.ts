import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Run a TypeScript entrypoint the same way `tsx` does, without npx or a shell.
 * On Windows, avoiding `shell: true` fixes stop/kill leaving orphan node processes.
 */
export function spawnTsxScript(
  projectRoot: string,
  scriptPath: string,
  options?: { stdio?: "pipe" | "ignore" }
): ChildProcess {
  const tsxCli = join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
  if (!existsSync(tsxCli)) {
    throw new Error(
      `tsx CLI not found at ${tsxCli}. Run npm install in the project root.`
    );
  }
  return spawn(process.execPath, [tsxCli, scriptPath], {
    cwd: projectRoot,
    stdio: options?.stdio ?? "pipe",
    env: { ...process.env, FORCE_COLOR: "0" },
    windowsHide: true,
  });
}
