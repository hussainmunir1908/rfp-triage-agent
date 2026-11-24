import { describe, expect, it } from "vitest";
import { findUncovered, pickForReview, type Statement } from "../coverage";
import { buildPageIndex, checkQuote } from "../verify";

const page = [
  "3.2 Functional Requirements",
  "Requirements marked [M] are mandatory. Requirements marked [D] are desired and will be scored.",
  "FR-1 Applicant portal. Web-based, mobile-responsive portal for creating an account, starting an",
  "application, uploading files and tracking status. M",
  "FR-2 AI completeness check. Check each package against the City's checklist for its permit type.",
  "Return a plain-language list of missing items within 2 minutes of submission. M",
  "FR-4 Plan-review assist. Extract key data from forms and drawings. The system must never approve",
  "or deny a permit; a licensed City reviewer makes every decision. M",
].join("\n");

const background = "The City has about 210,000 residents and processes permit applications every year.";

const fr1 =
  "Applicant portal. Web-based, mobile-responsive portal for creating an account, starting an application, uploading files and tracking status.";

describe("findUncovered", () => {
  it("returns the obligation statements nothing quoted, and leaves covered ones out", () => {
    const { statements, uncovered } = findUncovered([background, page], [{ page: 2, quote: fr1 }]);
    const texts = uncovered.map((s) => s.text);

    expect(statements.length).toBeGreaterThanOrEqual(4);
    expect(texts.some((t) => t.startsWith("FR-1"))).toBe(false);
    expect(texts.some((t) => t.includes("FR-2 AI completeness check"))).toBe(true);
    expect(texts.some((t) => t.includes("must never approve or deny a permit"))).toBe(true);
    expect(uncovered.every((s) => s.page === 2)).toBe(true);
  });

  it("reports every statement as covered when each one is quoted", () => {
    const quotes = [
      fr1,
      "FR-2 AI completeness check. Check each package against the City's checklist for its permit type. Return a plain-language list of missing items within 2 minutes of submission.",
      "FR-4 Plan-review assist. Extract key data from forms and drawings. The system must never approve or deny a permit; a licensed City reviewer makes every decision.",
      "Requirements marked [M] are mandatory. Requirements marked [D] are desired and will be scored.",
    ].map((quote) => ({ page: 2, quote }));
    expect(findUncovered([background, page], quotes).uncovered).toEqual([]);
  });

  it("finds nothing in text without obligations", () => {
    expect(findUncovered([background], [])).toEqual({ statements: [], uncovered: [] });
  });

  it("only produces statements that exist verbatim on their page, so they verify by construction", () => {
    const pages = [background, page];
    const index = buildPageIndex(pages);
    for (const s of findUncovered(pages, []).uncovered) {
      expect(checkQuote(index, s.page, s.text)).toMatchObject({
        verified: true,
        match: "exact",
        page: s.page,
      });
    }
  });

  it("treats ordinary obligation words as statements", () => {
    const text =
      "Proposals that do not meet every minimum qualification will be rejected without further evaluation.";
    const { uncovered } = findUncovered([text], []);
    expect(uncovered).toHaveLength(1);
    expect(uncovered[0].text).toBe(text);
  });

  it("catches restrictions and consequences written without must or shall", () => {
    const sentences = [
      "Failure to reach 90% Acceptable within 30 days of a cure notice is grounds for termination for default.",
      "After opening, proposals may not be withdrawn for 90 days.",
      "The County may terminate for convenience on 30 days' written notice, or for default as described in Section 9.",
      "A day porter keeps public areas clean and responds to spills within 15 minutes of a call.",
      "Signed Non-Collusion Affidavit (Form 5), notarized.",
    ];
    for (const sentence of sentences) {
      const { uncovered } = findUncovered([sentence], []);
      expect(uncovered, sentence).toHaveLength(1);
    }
  });

  it("does not turn plain background text into statements", () => {
    const text =
      "Larkspur County is in Ohio and has five facilities. The Board meets on Tuesdays at the courthouse.";
    expect(findUncovered([text], []).statements).toEqual([]);
  });
});

describe("pickForReview", () => {
  const make = (n: number, text: (i: number) => string): Statement[] =>
    Array.from({ length: n }, (_, i) => ({ id: i + 1, page: Math.floor(i / 10) + 1, text: text(i) }));

  it("keeps everything when it fits", () => {
    const all = make(5, () => "The contractor must do the work.");
    expect(pickForReview(all, 10)).toEqual(all);
  });

  it("spreads a cut over the whole document instead of taking the first pages", () => {
    const all = make(300, () => "The contractor must do the work.");
    const picked = pickForReview(all, 100);
    expect(picked).toHaveLength(100);
    expect(Math.max(...picked.map((s) => s.page))).toBeGreaterThanOrEqual(28);
    expect(picked.map((s) => s.id)).toEqual([...picked.map((s) => s.id)].sort((a, b) => a - b));
  });

  it("takes statements with strong obligation words before weaker ones", () => {
    const all = make(200, (i) =>
      i % 4 === 0 ? "The vendor must hold a license." : "The county may deduct a fee.",
    );
    const picked = pickForReview(all, 80);
    expect(picked).toHaveLength(80);
    const strong = all.filter((s) => s.text.includes("must"));
    expect(strong.every((s) => picked.includes(s))).toBe(true);
  });
});
