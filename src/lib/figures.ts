import type { FigureCheck } from "./types";

/**
 * Number checks done in code. A quote can exist in the document and still not prove what the model
 * says about it, and a document can contradict its own totals. Neither needs a model to find out.
 */

const MAGNITUDE: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  million: 1e6,
  b: 1e9,
  billion: 1e9,
};

const FIGURE = /(\$)?\s?(\d[\d,]*(?:\.\d+)?)\s*(million|billion|thousand|%|percent|[mkb]\b)?/gi;

export interface Figure {
  raw: string;
  value: number;
}

function toNumber(digits: string): number {
  return Number(digits.replace(/,/g, ""));
}

/**
 * Figures a reader would call out: money, percentages, and whole numbers of 10 or more. Single digits
 * and section numbers like 3.4 are skipped, because they are mostly labels and would cause false alarms.
 */
export function figuresIn(text: string): Figure[] {
  const out: Figure[] = [];
  for (const m of text.matchAll(FIGURE)) {
    const [raw, dollar, digits, unit] = m;
    let value = toNumber(digits);
    if (!Number.isFinite(value)) continue;
    const u = unit?.toLowerCase();
    if (u && MAGNITUDE[u]) value *= MAGNITUDE[u];
    if (!dollar && !u && value < 10) continue;
    out.push({ raw: raw.trim(), value });
  }
  return out;
}

const same = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-9);

/** Figures stated in `text` that do not appear in `quote`. */
export function unsupportedFigures(text: string, quote: string): string[] {
  const inQuote = figuresIn(quote);
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const f of figuresIn(text)) {
    if (inQuote.some((q) => same(q.value, f.value)) || seen.has(f.raw)) continue;
    seen.add(f.raw);
    missing.push(f.raw);
  }
  return missing;
}

/** Every number written on a page, however small. */
function numbersOn(text: string): number[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => toNumber(m[0])).filter(Number.isFinite);
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

export interface FigureIssue {
  issue: string;
  page: number;
  quote: string;
}

const PERCENT_TOLERANCE = 2; // percentage points; stated shares are often rounded ("about 72%")

/**
 * Compares claimed totals and percentages with the numbers the model copied from the document.
 * A check is dropped, not reported, when the copied numbers cannot be found on the page they were
 * said to come from, so a bad transcription cannot raise a false alarm.
 */
export function checkFigureClaims(checks: FigureCheck[], pages: string[]): FigureIssue[] {
  const onPage = (page: number) => numbersOn(pages[page - 1] ?? "");
  const anywhere = pages.map((_, i) => onPage(i + 1)).flat();
  const has = (list: number[], n: number) => list.some((x) => same(x, n));

  const issues: FigureIssue[] = [];
  for (const c of checks) {
    if (c.parts.length < 2 || !pages[c.parts_page - 1] || !pages[c.claim_page - 1]) continue;
    const partsHere = onPage(c.parts_page);
    if (!c.parts.every((p) => has(partsHere, p))) continue;

    const sum = c.parts.reduce((a, b) => a + b, 0);
    const claimHere = onPage(c.claim_page);

    if (c.claimed_total !== null && has(claimHere, c.claimed_total)) {
      if (!same(sum, c.claimed_total)) {
        issues.push({
          issue: `Page ${c.claim_page} states a total of ${fmt(c.claimed_total)} ("${c.claim_quote}"), but the figures listed on page ${c.parts_page} add up to ${fmt(sum)}.`,
          page: c.claim_page,
          quote: c.claim_quote,
        });
      }
    } else if (c.claimed_percent !== null && c.whole !== null && c.whole > 0) {
      if (!has(claimHere, c.claimed_percent) || !has(anywhere, c.whole)) continue;
      const share = (sum / c.whole) * 100;
      if (Math.abs(share - c.claimed_percent) > PERCENT_TOLERANCE) {
        issues.push({
          issue: `Page ${c.claim_page} states ${fmt(c.claimed_percent)}% ("${c.claim_quote}"), but the figures listed on page ${c.parts_page} add up to ${fmt(sum)}, which is ${fmt(share)}% of ${fmt(c.whole)}.`,
          page: c.claim_page,
          quote: c.claim_quote,
        });
      }
    }
  }
  return issues;
}
