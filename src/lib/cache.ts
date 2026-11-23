import { createHash } from "node:crypto";
import { analyzeRfp } from "./analyze";
import type { TriageReport } from "./types";

/**
 * Small in-memory cache keyed by the document text. The free model tier has a
 * tight daily request limit, so analysing the same RFP twice should not spend
 * it twice. The cache lives as long as the server instance does.
 */
const MAX_ENTRIES = 25;
const cache = new Map<string, TriageReport>();

function keyFor(pages: string[]): string {
  const hash = createHash("sha256");
  for (const p of pages) hash.update(p).update("\u0000");
  return hash.digest("hex");
}

export async function analyzeWithCache(args: {
  pages: string[];
  fileName: string;
  onProgress?: (stage: string, message: string) => void;
}): Promise<TriageReport> {
  const key = keyFor(args.pages);
  const hit = cache.get(key);
  if (hit) {
    args.onProgress?.("judge", "Found a saved analysis of this exact document.");
    return { ...hit, file_name: args.fileName, cached: true };
  }
  const report = await analyzeRfp(args);
  cache.set(key, report);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  return report;
}
