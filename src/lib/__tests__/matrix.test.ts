import { describe, expect, it } from "vitest";
import type { TriageReport } from "../types";
import { complianceMatrix } from "../matrix";

const report = {
  requirements: [
    {
      id: "r1",
      category: "certification",
      text: 'Hold a "Level 2" licence, valid in the state',
      mandatory: true,
      evidence: { page: 4, quote: "q", verified: true, match: "exact" },
    },
    {
      id: "r2",
      category: "functional",
      text: "Provide a dashboard",
      mandatory: false,
      evidence: { page: 9, quote: "q", verified: false, match: "none" },
    },
  ],
  qualification_checks: [{ requirement_id: "r1", status: "unknown" }],
} as unknown as TriageReport;

describe("complianceMatrix", () => {
  const lines = complianceMatrix(report).replace("\uFEFF", "").trim().split("\r\n");

  it("has a header and one row per requirement", () => {
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("ID,Category,Requirement,Mandatory,Page,Quote found,Our status,Owner,Notes");
  });

  it("escapes quotes and commas", () => {
    expect(lines[1]).toBe(
      'r1,certification,"Hold a ""Level 2"" licence, valid in the state",Yes,4,Yes,Confirm,,',
    );
  });

  it("marks requirements that were not checked against the profile", () => {
    expect(lines[2]).toBe("r2,functional,Provide a dashboard,No,9,No,To review,,");
  });
});
