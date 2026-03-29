import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const DATA_DIR = "data";
const HASHES_FILENAME = "jd_hashes.json";
const JD_HASHES_PATH = join(DATA_DIR, HASHES_FILENAME);

interface HashStoreData {
  hashes: string[];
}

function loadRaw(): HashStoreData {
  if (!existsSync(JD_HASHES_PATH)) {
    return { hashes: [] };
  }
  try {
    const raw = readFileSync(JD_HASHES_PATH, "utf8");
    const data = JSON.parse(raw) as HashStoreData;
    if (!Array.isArray(data.hashes)) {
      return { hashes: [] };
    }
    return { hashes: data.hashes };
  } catch {
    return { hashes: [] };
  }
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * In-memory set of hashes (call load() to refresh from disk).
 */
let cached: Set<string> | null = null;

/**
 * Load hashes from data/jd_hashes.json. Auto-creates empty store if file does not exist.
 * Call this before has() when you need up-to-date data.
 */
export function load(): Set<string> {
  const data = loadRaw();
  cached = new Set(data.hashes);
  return cached;
}

/**
 * Return whether the hash is in the store. Uses in-memory cache if already loaded;
 * otherwise loads from disk once.
 */
export function has(hash: string): boolean {
  if (cached === null) {
    load();
  }
  return cached!.has(hash);
}

/**
 * Add a hash to the store and persist to data/jd_hashes.json.
 * Creates data/ and the JSON file if they do not exist.
 */
export function add(hash: string): void {
  if (cached === null) {
    load();
  }
  cached!.add(hash);
  ensureDataDir();
  const data: HashStoreData = { hashes: [...cached!] };
  writeFileSync(JD_HASHES_PATH, JSON.stringify(data, null, 2), "utf8");
}
