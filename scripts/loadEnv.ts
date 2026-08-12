import fs from 'fs';
import path from 'path';

/**
 * Loads `.env.local` (then `.env`) into process.env for standalone tsx scripts.
 * Next.js loads these files automatically at runtime, but `tsx scripts/*.ts` does not.
 * Existing process.env values win, mirroring Next.js precedence, so a value set in the
 * shell is never overwritten.
 */
function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return key ? [key, value] : null;
}

export function loadLocalEnv(rootDir?: string): void {
  const dir = rootDir ?? process.cwd();
  for (const file of ['.env.local', '.env']) {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (parsed && !(parsed[0] in process.env)) {
        process.env[parsed[0]] = parsed[1];
      }
    }
  }
}

// Runs at import time so any module imported after this one (e.g. the MongoDB
// connection, which reads env at module top-level) sees the loaded values.
loadLocalEnv();
