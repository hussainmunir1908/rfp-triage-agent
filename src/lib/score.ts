import type { CheckStatus, Extraction } from "./types";

/**
 * The decision rule. It lives in code, not in the prompt, so the same factors
 * always produce the same score and call, and the rule can be read and tested.
 */

export const BASE_SCORE = 5;
export const BID_THRESHOLD = 6;
const DEAL_BREAKER_CAP = 3;
const OUT_OF_DOMAIN_CAP = 2;
/** The profile cannot confirm a mandatory qualification, so a perfect score would overstate what is known. */
const ONE_UNKNOWN_CAP = 8;
const MANY_UNKNOWN_CAP = 7;
const MANY_UNKNOWN = 3;

/** A document with almost no stated requirements cannot support a confident score. */
const THIN_CAP = 6;
export const THIN_MIN_REQUIREMENTS = 5;

const OUT_OF_DOMAIN: Extraction["work_category"][] = [
  "construction_or_facilities",
  "manufacturing_or_supplies",
];

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export interface Decision {
  fitScore: number;
  decision: "BID" | "NO_BID";
  fastNoBid: boolean;
}

export function decide(args: {
  impacts: number[];
  dealBreakers: number;
  workCategory: Extraction["work_category"];
  /** Result of each mandatory qualification check against the company profile. */
  checks?: CheckStatus[];
  /** Too few requirements were found for the score to mean much, as with a one-page notice. */
  thin?: boolean;
}): Decision {
  const checks = args.checks ?? [];
  const unknown = checks.filter((c) => c === "unknown").length;
  const blocked = checks.filter((c) => c === "blocked").length;
  const dealBreakers = args.dealBreakers + blocked;

  const raw = BASE_SCORE + args.impacts.reduce((n, i) => n + i, 0);
  let fitScore = clamp(Math.round(raw), 0, 10);

  const fastNoBid = OUT_OF_DOMAIN.includes(args.workCategory);
  if (unknown >= MANY_UNKNOWN) fitScore = Math.min(fitScore, MANY_UNKNOWN_CAP);
  else if (unknown > 0) fitScore = Math.min(fitScore, ONE_UNKNOWN_CAP);
  if (dealBreakers > 0) fitScore = Math.min(fitScore, DEAL_BREAKER_CAP);
  if (args.thin) fitScore = Math.min(fitScore, THIN_CAP);
  if (fastNoBid) fitScore = Math.min(fitScore, OUT_OF_DOMAIN_CAP);

  const bid = dealBreakers === 0 && !fastNoBid && fitScore >= BID_THRESHOLD;
  return { fitScore, decision: bid ? "BID" : "NO_BID", fastNoBid };
}
