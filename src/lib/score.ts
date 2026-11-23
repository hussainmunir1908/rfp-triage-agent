import type { Extraction } from "./types";

/**
 * The decision rule. It lives in code, not in the prompt, so the same factors
 * always produce the same score and call, and the rule can be read and tested.
 */

export const BASE_SCORE = 5;
export const BID_THRESHOLD = 6;
const DEAL_BREAKER_CAP = 3;
const OUT_OF_DOMAIN_CAP = 2;

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
}): Decision {
  const raw = BASE_SCORE + args.impacts.reduce((n, i) => n + i, 0);
  let fitScore = clamp(Math.round(raw), 0, 10);

  const fastNoBid = OUT_OF_DOMAIN.includes(args.workCategory);
  if (args.dealBreakers > 0) fitScore = Math.min(fitScore, DEAL_BREAKER_CAP);
  if (fastNoBid) fitScore = Math.min(fitScore, OUT_OF_DOMAIN_CAP);

  const bid = args.dealBreakers === 0 && !fastNoBid && fitScore >= BID_THRESHOLD;
  return { fitScore, decision: bid ? "BID" : "NO_BID", fastNoBid };
}
