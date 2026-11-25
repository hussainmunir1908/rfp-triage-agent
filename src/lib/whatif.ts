import {
  BASE_SCORE,
  DEAL_BREAKER_CAP,
  MANY_UNKNOWN,
  MANY_UNKNOWN_CAP,
  ONE_UNKNOWN_CAP,
  OUT_OF_DOMAIN_CAP,
  THIN_CAP,
  decide,
  type Decision,
} from "./score";
import type { CheckStatus, Extraction, TriageReport } from "./types";

/**
 * What-if analysis on a finished report. The decision rule is code (see score.ts), so the same factors
 * can be re-run in the browser with one assumption changed: no model call, no waiting.
 */

export interface Scenario {
  /** Status of each mandatory qualification check, in report order. */
  checks: CheckStatus[];
  /** Whether each deal-breaker has been waived or solved, in report order. */
  waived: boolean[];
  /** Impact of each score factor, in report order. */
  impacts: number[];
}

export type Move =
  | { kind: "check"; index: number; to: CheckStatus }
  | { kind: "dealbreaker"; index: number }
  | { kind: "factor"; index: number; to: number };

export interface Flip {
  /** The call this set of changes would produce. */
  to: "BID" | "NO_BID";
  moves: Move[];
  result: Decision;
}

export interface FlipSearch {
  /** Shortest sets of changes that reverse the call, best first. */
  flips: Flip[];
  /** True when the work is out of domain, which no change of assumptions overrides. */
  locked: boolean;
}

const MAX_CANDIDATES = 14;
const MAX_SET_SIZE = 4;
const MAX_RESULTS = 3;

export function baseScenario(report: TriageReport): Scenario {
  return {
    checks: report.qualification_checks.map((c) => c.status),
    waived: report.deal_breakers.map(() => false),
    impacts: report.factors.map((f) => f.impact),
  };
}

export function evaluate(report: TriageReport, s: Scenario): Decision {
  return decide({
    impacts: s.impacts,
    dealBreakers: s.waived.filter((w) => !w).length,
    workCategory: report.work_category as Extraction["work_category"],
    checks: s.checks,
    thin: report.thin_document,
  });
}

export function apply(s: Scenario, move: Move): Scenario {
  switch (move.kind) {
    case "check":
      return { ...s, checks: s.checks.map((c, i) => (i === move.index ? move.to : c)) };
    case "dealbreaker":
      return { ...s, waived: s.waived.map((w, i) => (i === move.index ? true : w)) };
    case "factor":
      return { ...s, impacts: s.impacts.map((v, i) => (i === move.index ? move.to : v)) };
  }
}

export function isChanged(base: Scenario, s: Scenario): boolean {
  return (
    s.checks.some((c, i) => c !== base.checks[i]) ||
    s.waived.some((w, i) => w !== base.waived[i]) ||
    s.impacts.some((v, i) => v !== base.impacts[i])
  );
}

/** Changes that could only help the case for bidding, strongest first. */
function favourable(s: Scenario, base: Scenario): Move[] {
  const moves: Move[] = [];
  s.impacts.forEach((v, index) => {
    // Undo a change the reader made, or neutralise a concern the report raised.
    const target = Math.max(0, base.impacts[index]) > v ? Math.max(0, base.impacts[index]) : 0;
    if (v < 0 || target > v) moves.push({ kind: "factor", index, to: target });
  });
  s.checks.forEach((c, index) => {
    // "at risk" does not enter the rule, so confirming it changes nothing.
    if (c === "unknown" || c === "blocked") moves.push({ kind: "check", index, to: "met" });
  });
  s.waived.forEach((w, index) => {
    if (!w) moves.push({ kind: "dealbreaker", index });
  });
  return moves.sort((a, b) => weight(b, s) - weight(a, s)).slice(0, MAX_CANDIDATES);
}

/** Changes that could only hurt the case for bidding. */
function unfavourable(s: Scenario, base: Scenario): Move[] {
  const moves: Move[] = [];
  s.impacts.forEach((v, index) => {
    const target = Math.min(0, base.impacts[index]) < v ? Math.min(0, base.impacts[index]) : 0;
    if (v > 0 || target < v) moves.push({ kind: "factor", index, to: target });
  });
  s.checks.forEach((c, index) => {
    if (c !== "blocked") moves.push({ kind: "check", index, to: "blocked" });
  });
  return moves.sort((a, b) => weight(b, s) - weight(a, s)).slice(0, MAX_CANDIDATES);
}

function weight(m: Move, s: Scenario): number {
  if (m.kind === "factor") return Math.abs(m.to - s.impacts[m.index]);
  return 3;
}

function* combinations<T>(items: T[], size: number, start = 0, head: T[] = []): Generator<T[]> {
  if (head.length === size) {
    yield head;
    return;
  }
  for (let i = start; i < items.length; i++) yield* combinations(items, size, i + 1, [...head, items[i]]);
}

/**
 * The smallest sets of changes that reverse the current call. Search goes by set size, so the first
 * size that works is the shortest possible among the candidate changes.
 */
export function findFlips(report: TriageReport, s: Scenario, base: Scenario = s): FlipSearch {
  const now = evaluate(report, s);
  if (now.fastNoBid) return { flips: [], locked: true };

  const target = now.decision === "BID" ? "NO_BID" : "BID";
  const candidates = target === "BID" ? favourable(s, base) : unfavourable(s, base);

  for (let size = 1; size <= Math.min(MAX_SET_SIZE, candidates.length); size++) {
    const found: Flip[] = [];
    for (const moves of combinations(candidates, size)) {
      const next = moves.reduce(apply, s);
      const result = evaluate(report, next);
      if (result.decision === target) found.push({ to: target, moves, result });
    }
    if (found.length > 0) {
      found.sort((a, b) =>
        target === "BID" ? b.result.fitScore - a.result.fitScore : a.result.fitScore - b.result.fitScore,
      );
      return { flips: found.slice(0, MAX_RESULTS), locked: false };
    }
  }
  return { flips: [], locked: false };
}

/** The score arithmetic for a scenario in plain words, so a changed call is never a black box. */
export function explain(report: TriageReport, s: Scenario): string[] {
  const d = evaluate(report, s);
  const sum = s.impacts.reduce((n, i) => n + i, 0);
  const raw = Math.max(0, Math.min(10, BASE_SCORE + sum));
  const lines = [
    `Start at ${BASE_SCORE}, ${sum >= 0 ? "add" : "take away"} ${Math.abs(sum)} from the factors: ${raw}.`,
  ];

  const unknown = s.checks.filter((c) => c === "unknown").length;
  const standing = s.waived.filter((w) => !w).length + s.checks.filter((c) => c === "blocked").length;

  if (d.fastNoBid) lines.push(`Out-of-domain work is capped at ${OUT_OF_DOMAIN_CAP} and is a fast no-bid.`);
  if (report.thin_document) {
    lines.push(`Very few requirements were found in the document, so the score is capped at ${THIN_CAP}.`);
  }
  if (standing > 0) {
    lines.push(
      `${standing} deal-breaker${standing === 1 ? "" : "s"} standing: the score is capped at ${DEAL_BREAKER_CAP} and the call is no-bid.`,
    );
  }
  if (unknown >= MANY_UNKNOWN) {
    lines.push(`${unknown} unconfirmed checks cap the score at ${MANY_UNKNOWN_CAP}.`);
  } else if (unknown > 0) {
    lines.push(
      `${unknown} unconfirmed check${unknown === 1 ? "" : "s"} cap the score at ${ONE_UNKNOWN_CAP}.`,
    );
  }
  lines.push(
    d.decision === "BID"
      ? `${d.fitScore} is at or above the bid line of 6, and nothing blocks it.`
      : d.fastNoBid || standing > 0
        ? "A bid needs a score of 6 or more with no deal-breaker."
        : `${d.fitScore} is below the bid line of 6.`,
  );
  return lines;
}
