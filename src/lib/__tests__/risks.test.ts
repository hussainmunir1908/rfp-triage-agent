import { describe, expect, it } from "vitest";
import { scanRisks } from "../risks";

const find = (pages: string[], rule: string) => scanRisks(pages).filter((f) => f.rule === rule);

describe("scanRisks", () => {
  it("flags a liability cap that has exceptions", () => {
    const [f] = find(
      [
        "Each party’s liability is limited to two times the total contract value, except for indemnity, data breach and gross negligence, which are not limited.",
      ],
      "liability",
    );
    expect(f).toMatchObject({ severity: "medium", title: "Liability cap with exceptions", page: 1 });
  });

  it("flags unlimited liability as high", () => {
    const [f] = find(
      ["The Contractor accepts unlimited liability for any damage to County property."],
      "liability",
    );
    expect(f.severity).toBe("high");
  });

  it("does not treat insurance limits as a liability cap", () => {
    expect(
      find(["Commercial general liability insurance of $1,000,000 per occurrence is required."], "liability"),
    ).toHaveLength(0);
  });

  it("reads the size of service credits", () => {
    const [f] = find(
      [
        "The City will receive a service credit of 5% of the monthly subscription fee for each missed target, up to 25% per month.",
      ],
      "damages",
    );
    expect(f).toMatchObject({ title: "Service credits", severity: "high" });
  });

  it("does not mistake an availability target for the size of the credit", () => {
    const [f] = find(
      [
        "If availability falls below 99.5%, the City will receive a service credit of 5% of the monthly fee, up to 25% per month.",
      ],
      "damages",
    );
    expect(f.why).toContain("25%");
    expect(f.why).not.toContain("99.5");
  });

  it("ignores penalty wording inside a tax form", () => {
    expect(
      find(
        ["If delinquent, the amount of delinquent taxes, penalties and interest is $______________."],
        "damages",
      ),
    ).toHaveLength(0);
  });

  it("flags security breach costs", () => {
    const [f] = find(
      [
        "In the event of a Breach by the Seller, Seller agrees to promptly reimburse all costs to the City arising from such Breach, including notification of individuals.",
      ],
      "breach",
    );
    expect(f.severity).toBe("high");
  });

  it("does not report breach costs again as penalties", () => {
    const text =
      "In the event of a Breach by the Seller, Seller agrees to promptly reimburse all costs to the City, including penalties and notification of individuals.";
    expect(find([text], "damages")).toHaveLength(0);
    expect(find([text], "breach")).toHaveLength(1);
  });

  it("grades payment terms by length", () => {
    expect(
      find(["Payment will be made net 30 days after receipt of a properly submitted invoice."], "payment")[0]
        .severity,
    ).toBe("info");
    expect(
      find(["The City pays each invoice within sixty (60) days of receipt of the invoice."], "payment")[0]
        .severity,
    ).toBe("high");
  });

  it("flags a full performance bond as high and a bid guaranty as medium", () => {
    expect(
      find(["Performance bond: 100% of the annual contract price, within 10 days of award."], "bonds")[0]
        .severity,
    ).toBe("high");
    expect(
      find(["Each proposal must be accompanied by a bid guaranty as described in Section 6."], "bonds")[0]
        .severity,
    ).toBe("medium");
  });

  it("requires onsite wording to be an obligation, not marketing", () => {
    expect(
      find(
        [
          "The ideal solution will help the City provide excellent customer service, both in person and online.",
        ],
        "onsite",
      ),
    ).toHaveLength(0);
    expect(
      find(["The Project Manager must attend the project kickoff in person in Port Alder."], "onsite"),
    ).toHaveLength(1);
  });

  it("skips lists of FAR clause titles", () => {
    const list =
      "52.227-3 Patent Indemnity 52.249-2 Termination for Convenience of the Government (Fixed-Price) 52.249-8 Default";
    expect(scanRisks([list])).toHaveLength(0);
  });

  it("notes data ownership without calling it a risk to the platform", () => {
    const [f] = find(
      ["Protected Data will at all times remain the sole property of the City and belongs to the City."],
      "ip",
    );
    expect(f.severity).toBe("info");
  });

  it("cuts a long sentence around the matching words and keeps it verbatim", () => {
    const filler = "Severity Definition Response Resolution ".repeat(20);
    const sentence = `${filler}The City will receive a service credit of 5% of the monthly fee up to 25% per month ${filler}`;
    const [f] = find([sentence], "damages");
    expect(f.quote.length).toBeLessThanOrEqual(320);
    expect(f.quote).toContain("service credit");
    expect(sentence.replace(/\s+/g, " ")).toContain(f.quote);
  });

  it("orders findings with the worst first and records the page", () => {
    const out = scanRisks([
      "Payment will be made net 30 days after receipt of a properly submitted invoice.",
      "Performance bond: 100% of the annual contract price, within 10 days of award.",
    ]);
    expect(out[0]).toMatchObject({ severity: "high", page: 2 });
  });

  it("returns nothing for a document without risk wording", () => {
    expect(scanRisks(["The City of Owosso seeks a modern, accessible website for its residents."])).toEqual(
      [],
    );
  });
});
