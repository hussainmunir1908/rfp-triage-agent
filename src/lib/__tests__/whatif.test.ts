import { describe, expect, it } from "vitest";
import { decide } from "../score";
import type { CheckStatus, TriageReport } from "../types";
import { apply, baseScenario, evaluate, findFlips, isChanged } from "../whatif";

function report(opts: {
  impacts: number[];
  checks?: CheckStatus[];
  dealBreakers?: number;
  category?: string;
  thin?: boolean;
}): TriageReport {
  const checks = opts.checks ?? [];
  const dealBreakers = opts.dealBreakers ?? 0;
  const d = decide({
    impacts: opts.impacts,
    dealBreakers,
    workCategory: (opts.category ?? "software_development") as never,
    checks,
    thin: opts.thin,
  });
  return {
    decision: d.decision,
    fit_score: d.fitScore,
    fast_no_bid: d.fastNoBid,
    thin_document: opts.thin,
    work_category: opts.category ?? "software_development",
    factors: opts.impacts.map((impact, i) => ({ name: `f${i}`, impact, reason: "", refs: [] })),
    qualification_checks: checks.map((status, i) => ({
      requirement_id: `r${i}`,
      requirement: `check ${i}`,
      status,
      note: "",
      evidence: null,
    })),
    deal_breakers: Array.from({ length: dealBreakers }, () => ({ text: "x", refs: [] })),
  } as unknown as TriageReport;
}

describe("evaluate", () => {
  it("reproduces the decision stored in the report", () => {
    const r = report({ impacts: [2, -1, 1], checks: ["met", "unknown"], dealBreakers: 0 });
    const d = evaluate(r, baseScenario(r));
    expect(d.fitScore).toBe(r.fit_score);
    expect(d.decision).toBe(r.decision);
  });

  it("lets a waived deal-breaker lift the cap", () => {
    const r = report({ impacts: [3, 2], dealBreakers: 1 });
    expect(r.decision).toBe("NO_BID");
    const next = apply(baseScenario(r), { kind: "dealbreaker", index: 0 });
    expect(evaluate(r, next)).toMatchObject({ decision: "BID", fitScore: 10 });
  });

  it("detects when a scenario differs from the report", () => {
    const r = report({ impacts: [1], checks: ["unknown"] });
    const base = baseScenario(r);
    expect(isChanged(base, base)).toBe(false);
    expect(isChanged(base, apply(base, { kind: "check", index: 0, to: "met" }))).toBe(true);
  });
});

describe("findFlips", () => {
  it("finds the single change that turns a no-bid into a bid", () => {
    const r = report({ impacts: [1, -2], checks: ["met"] });
    expect(r.decision).toBe("NO_BID");
    const { flips, locked } = findFlips(r, baseScenario(r));
    expect(locked).toBe(false);
    expect(flips[0].to).toBe("BID");
    expect(flips[0].moves).toEqual([{ kind: "factor", index: 1, to: 0 }]);
    expect(flips[0].result.decision).toBe("BID");
  });

  it("needs every blocker lifted when two deal-breakers stand", () => {
    const r = report({ impacts: [3, 2], dealBreakers: 2 });
    const { flips } = findFlips(r, baseScenario(r));
    expect(flips[0].moves).toHaveLength(2);
    expect(flips[0].moves.every((m) => m.kind === "dealbreaker")).toBe(true);
  });

  it("shows what could sink a bid", () => {
    const r = report({ impacts: [2], checks: ["met", "met"] });
    expect(r.decision).toBe("BID");
    const { flips } = findFlips(r, baseScenario(r));
    expect(flips.length).toBeGreaterThan(0);
    expect(flips.every((f) => f.to === "NO_BID")).toBe(true);
    expect(flips[0].moves).toHaveLength(1);
  });

  it("does not offer a way out of out-of-domain work", () => {
    const r = report({ impacts: [3, 3], category: "construction_or_facilities" });
    expect(findFlips(r, baseScenario(r))).toEqual({ flips: [], locked: true });
  });

  it("returns nothing when no short change reverses the call", () => {
    const r = report({ impacts: [-3, -3, -3, -3, -3] });
    // Raising all five to zero still only reaches 5, below the threshold of 6.
    expect(findFlips(r, baseScenario(r)).flips).toEqual([]);
  });
});

describe("findFlips after the reader changes something", () => {
  it("offers to restore the report's value", () => {
    const r = report({ impacts: [2], checks: ["met"] });
    expect(r.decision).toBe("BID");
    const base = baseScenario(r);
    const lowered = apply(base, { kind: "factor", index: 0, to: -1 });
    expect(evaluate(r, lowered).decision).toBe("NO_BID");
    const { flips } = findFlips(r, lowered, base);
    expect(flips[0].moves).toEqual([{ kind: "factor", index: 0, to: 2 }]);
  });
});

describe("thin documents", () => {
  it("keep the cap when the reader changes assumptions", () => {
    const r = report({ impacts: [3, 3], thin: true });
    expect(r.fit_score).toBe(6);
    const next = apply(baseScenario(r), { kind: "factor", index: 0, to: 3 });
    expect(evaluate(r, next).fitScore).toBe(6);
  });
});
