import { describe, expect, it } from "vitest";
import { checkFigureClaims, figuresIn, unsupportedFigures } from "../figures";
import type { FigureCheck } from "../types";

describe("figuresIn", () => {
  it("reads money, percentages and large numbers in different notations", () => {
    expect(figuresIn("$1,000,000 per occurrence").map((f) => f.value)).toEqual([1_000_000]);
    expect(figuresIn("$1M").map((f) => f.value)).toEqual([1_000_000]);
    expect(figuresIn("less than $15 million").map((f) => f.value)).toEqual([15_000_000]);
    expect(figuresIn("availability of 99.5%").map((f) => f.value)).toEqual([99.5]);
    expect(figuresIn("about 3,200 applications").map((f) => f.value)).toEqual([3200]);
  });

  it("skips single digits and section numbers", () => {
    expect(figuresIn("see Section 3.4, items 2 and 5 within 2 minutes")).toEqual([]);
  });
});

describe("unsupportedFigures", () => {
  it("is empty when the quote carries the same figures", () => {
    expect(unsupportedFigures("at least $15 million", "gross receipts of less than $15 million")).toEqual([]);
    expect(unsupportedFigures("$1M per occurrence", "$1,000,000 per occurrence")).toEqual([]);
  });

  it("lists figures the quote does not contain", () => {
    const quote = "must provide certificates showing the coverage below";
    expect(unsupportedFigures("General liability of $1M and cyber of $2M", quote)).toEqual(["$1M", "$2M"]);
  });
});

const pages = [
  "intro",
  "The ten pilot types account for about 72% of annual volume. Total applications 14,000 per year",
  "1 Alteration 1,860 2 Electrical 1,720 3 Addition 1,120 4 Commercial 1,150 5 HVAC 1,040 " +
    "6 Tenant 980 7 Plumbing 910 8 Dwelling 960 9 Right-of-way 720 10 Sign 640",
];

const share: FigureCheck = {
  claim: "the share of annual volume covered by the ten pilot permit types",
  claim_quote: "account for about 72% of annual volume",
  claim_page: 2,
  claimed_total: null,
  claimed_percent: 72,
  whole: 14000,
  parts: [1860, 1720, 1120, 1150, 1040, 980, 910, 960, 720, 640],
  parts_page: 3,
};

describe("checkFigureClaims", () => {
  it("reports a stated share that the listed figures contradict", () => {
    const [issue] = checkFigureClaims([share], pages);
    expect(issue.issue).toContain("79.3% of 14,000");
    expect(issue.issue).toContain("11,100");
    expect(issue.page).toBe(2);
  });

  it("accepts a rounded share within tolerance", () => {
    expect(
      checkFigureClaims(
        [{ ...share, claimed_percent: 79 }],
        pages.map((p) => p.replace("72%", "79%")),
      ),
    ).toEqual([]);
  });

  it("reports a total that does not match its parts, and accepts one that does", () => {
    const total: FigureCheck = {
      ...share,
      claimed_percent: null,
      whole: null,
      claimed_total: 14000,
      claim_quote: "Total applications 14,000",
    };
    expect(checkFigureClaims([total], pages)).toHaveLength(1);
    expect(
      checkFigureClaims(
        [{ ...total, claimed_total: 11100 }],
        [...pages.slice(0, 1), "Total 11,100", pages[2]],
      ),
    ).toEqual([]);
  });

  it("drops a check whose copied numbers are not on the cited page", () => {
    expect(checkFigureClaims([{ ...share, parts: [1860, 1720, 99999] }], pages)).toEqual([]);
    expect(checkFigureClaims([{ ...share, parts_page: 1 }], pages)).toEqual([]);
  });
});
