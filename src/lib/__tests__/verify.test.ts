import { describe, expect, it } from "vitest";
import { buildPageIndex, checkQuote, normalize } from "../verify";

const pages = [
  "REQUEST FOR PROPOSALS\nThe State shall award a firm-fixed-price contract for pension modernization services.",
  "Proposals are due no later than April 30, 2025 at 3:00 PM Local Time.\nQuestions are due April 2, 2025.",
  "Vendor must be properly licensed to transact busi-\nness in the State of Delaware.",
];
const index = buildPageIndex(pages);

describe("normalize", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(normalize("  April 30,\n2025 ")).toBe("april 30 2025");
  });
});

describe("checkQuote", () => {
  it("finds an exact quote on the cited page", () => {
    const ev = checkQuote(index, 2, "Proposals are due no later than April 30, 2025 at 3:00 PM Local Time.");
    expect(ev).toMatchObject({ verified: true, match: "exact", page: 2 });
    expect(ev.corrected_from_page).toBeUndefined();
  });

  it("corrects the page when the model cites the wrong one", () => {
    const ev = checkQuote(index, 1, "Questions are due April 2, 2025");
    expect(ev).toMatchObject({ verified: true, page: 2, corrected_from_page: 1 });
  });

  it("matches a quote that spans a page break", () => {
    const ev = checkQuote(
      index,
      1,
      "pension modernization services. Proposals are due no later than April 30",
    );
    expect(ev.verified).toBe(true);
  });

  it("accepts a close match with one wrong word", () => {
    const ev = checkQuote(
      index,
      2,
      "Proposals are due no later than April 30, 2025 at 3:00 PM Pacific Time.",
    );
    expect(ev).toMatchObject({ verified: true, match: "close" });
  });

  it("rejects a quote that is not in the document", () => {
    const ev = checkQuote(index, 2, "Vendors must hold a TS/SCI facility clearance at the time of award.");
    expect(ev).toMatchObject({ verified: false, match: "none" });
  });

  it("rejects an empty or tiny quote", () => {
    expect(checkQuote(index, 1, "").verified).toBe(false);
    expect(checkQuote(index, 1, "the").verified).toBe(false);
  });
});
