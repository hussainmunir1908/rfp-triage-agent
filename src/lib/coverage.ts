import { normalize } from "./verify";

/**
 * Recall check. A model reading a long RFP tends to stop listing requirements after the first few
 * dozen. This finds every sentence that sounds like an obligation (must, shall, required, [M], numbered
 * requirement ids, "will be rejected") and reports the ones no extracted item quotes.
 */

export interface Statement {
  id: number;
  page: number;
  text: string;
}

export interface CoverageResult {
  statements: Statement[];
  /** Statements that no extracted item quotes. */
  uncovered: Statement[];
}

const KEYWORD = new RegExp(
  [
    String.raw`\[[MD]\]`,
    String.raw`\b(?:must|shall|required|mandatory|mandated|disqualif\w*)\b`,
    String.raw`\bwill (?:not )?be (?:rejected|accepted)\b`,
    String.raw`\bnot be accepted\b`,
    // duties written as "the Contractor will ..." and limits written as numbers
    String.raw`\b(?:contractor|proposer|vendor|offeror|bidder)s? (?:will|may not)\b`,
    String.raw`\b(?:no more than|no later than|not exceed|at least|no less than|not less than|minimum of)\b`,
    // restrictions, consequences and deadlines that are written without "must" or "shall"
    String.raw`\b(?:may not|may (?:issue|deduct|withhold|reject|terminate|require)|grounds for|non-?responsive|cure notice)\b`,
    String.raw`\b(?:terminat\w*|liquidated damages|penalt(?:y|ies)|indemnif\w+|notariz\w+|notary)\b`,
    String.raw`\bwithin (?:\d+|\w+ \(\d+\)) (?:minutes?|hours?|business days?|calendar days?|days?|weeks?|months?)\b`,
  ].join("|"),
  "gi",
);
const REQUIREMENT_ID = /\b[A-Z]{1,4}-\d{1,3}[a-z]?\b/g;

const MAX_STATEMENT = 400;
const MIN_STATEMENT = 25;
const COVERED_SHARE = 0.4;

interface Span {
  start: number;
  end: number;
}

/** Normalised text plus, for every character, its position in the original string. */
function mapNormalize(raw: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < raw.length; i++) {
    const base = raw[i]
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    for (const c of base) {
      if (/[a-z0-9]/.test(c)) {
        text += c;
        map.push(i);
        lastSpace = false;
      } else if (!lastSpace) {
        text += " ";
        map.push(i);
        lastSpace = true;
      }
    }
  }
  return { text, map };
}

/** Where a quote sits in the page text, tolerating extraction noise at the edges. */
function locate(norm: { text: string; map: number[] }, quote: string): Span | null {
  const q = normalize(quote);
  if (q.length < 6) return null;
  let at = norm.text.indexOf(q);
  let len = q.length;
  if (at < 0) {
    const words = q.split(" ");
    if (words.length < 8) return null;
    const head = words.slice(0, 4).join(" ");
    const tail = words.slice(-4).join(" ");
    const h = norm.text.indexOf(head);
    const t = h >= 0 ? norm.text.indexOf(tail, h) : -1;
    if (h < 0 || t < 0 || t + tail.length - h > q.length * 2) return null;
    at = h;
    len = t + tail.length - h;
  }
  return { start: norm.map[at], end: norm.map[Math.min(at + len, norm.map.length) - 1] + 1 };
}

function snapStart(text: string, from: number): number {
  const start = Math.max(0, from);
  if (start === 0) return 0;
  const space = text.indexOf(" ", start);
  return space < 0 ? start : space + 1;
}

function snapEnd(text: string, to: number): number {
  if (to >= text.length) return text.length;
  const space = text.lastIndexOf(" ", to);
  return space <= 0 ? to : space;
}

function sentenceStart(text: string, pos: number): number {
  const floor = Math.max(0, pos - 300);
  for (let i = pos - 1; i > floor; i--) {
    if (/[.!?;]/.test(text[i]) && text[i + 1] === " ") return i + 2;
  }
  return snapStart(text, floor);
}

function sentenceEnd(text: string, pos: number): number {
  const ceil = Math.min(text.length, pos + 300);
  for (let i = pos; i < ceil; i++) {
    if (/[.!?]/.test(text[i]) && (text[i + 1] === " " || i === text.length - 1)) return i + 1;
  }
  return snapEnd(text, ceil);
}

/** Obligation statements on one page, as verbatim spans of the page text. */
function statementsOn(flat: string): Span[] {
  const spans: Span[] = [];
  for (const m of flat.matchAll(KEYWORD)) {
    const pos = m.index ?? 0;
    spans.push({ start: sentenceStart(flat, pos), end: sentenceEnd(flat, pos + m[0].length) });
  }
  const ids = [...flat.matchAll(REQUIREMENT_ID)].map((m) => m.index ?? 0);
  ids.forEach((pos, i) => {
    const next = ids[i + 1] ?? flat.length;
    spans.push({ start: pos, end: snapEnd(flat, Math.min(next, pos + MAX_STATEMENT)) });
  });

  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Span[] = [];
  for (const s of spans) {
    const last = merged.at(-1);
    if (last && s.start < last.end && Math.max(s.end, last.end) - last.start <= MAX_STATEMENT * 1.5) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ ...s });
    }
  }
  return merged.filter((s) => s.end - s.start >= MIN_STATEMENT);
}

const STRONG =
  /\[M\]|\b(?:must|shall|required|mandatory|disqualif\w*|(?:will )?not be accepted|will be rejected)\b/i;

/** `count` items spread evenly over the list, in their original order. */
function spread<T>(items: T[], count: number): T[] {
  if (count >= items.length) return items;
  return Array.from({ length: count }, (_, i) => items[Math.floor((i * items.length) / count)]);
}

/**
 * Chooses which statements get reviewed when there are more than the review can hold. Taking the first
 * ones would silently drop the back half of the document, where evaluation criteria and submission rules
 * usually are. Statements with strong obligation words go first, and any cut is spread across all pages.
 */
export function pickForReview(uncovered: Statement[], cap: number): Statement[] {
  if (uncovered.length <= cap) return uncovered;
  const strong = uncovered.filter((s) => STRONG.test(s.text));
  const weak = uncovered.filter((s) => !STRONG.test(s.text));
  const chosen =
    strong.length >= cap ? spread(strong, cap) : [...strong, ...spread(weak, cap - strong.length)];
  return chosen.sort((a, b) => a.id - b.id);
}

export function findUncovered(pages: string[], cited: { page: number; quote: string }[]): CoverageResult {
  const statements: Statement[] = [];
  const uncovered: Statement[] = [];

  pages.forEach((raw, i) => {
    const page = i + 1;
    const flat = raw.replace(/\s+/g, " ").trim();
    if (!flat) return;
    const norm = mapNormalize(flat);
    const covered = cited
      .filter((c) => c.page === page)
      .map((c) => locate(norm, c.quote))
      .filter((s): s is Span => s !== null);

    for (const span of statementsOn(flat)) {
      const text = flat.slice(span.start, span.end).trim();
      const statement: Statement = { id: statements.length + 1, page, text };
      statements.push(statement);

      const length = span.end - span.start;
      const overlap = covered.reduce(
        (n, c) => n + Math.max(0, Math.min(c.end, span.end) - Math.max(c.start, span.start)),
        0,
      );
      if (overlap / length < COVERED_SHARE) uncovered.push(statement);
    }
  });
  return { statements, uncovered };
}
