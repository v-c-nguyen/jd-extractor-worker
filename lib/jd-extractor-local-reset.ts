import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = "cache";
const DATA_DIR = "data";
const JD_HASHES_FILENAME = "jd_hashes.json";

function projectPath(...segments: string[]): string {
  return join(process.cwd(), ...segments);
}

/**
 * Deletes cached JD `.txt` files under `cache/` and resets `data/jd_hashes.json`
 * to an empty hash list. Used by the job extractor UI local reset action.
 */
export function clearJdExtractorLocalState(): { removedCacheFiles: number } {
  const cachePath = projectPath(CACHE_DIR);
  let removedCacheFiles = 0;
  if (existsSync(cachePath)) {
    for (const ent of readdirSync(cachePath, { withFileTypes: true })) {
      if (!ent.isFile() || !ent.name.endsWith(".txt")) continue;
      unlinkSync(join(cachePath, ent.name));
      removedCacheFiles += 1;
    }
  }

  const dataDir = projectPath(DATA_DIR);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  const hashesPath = projectPath(DATA_DIR, JD_HASHES_FILENAME);
  writeFileSync(hashesPath, JSON.stringify({ hashes: [] }, null, 2), "utf8");

  return { removedCacheFiles };
}
