import { describe, expect, it } from "vitest";
import { datesIn, deadlineStatus, markSuperseded, resolveDate, statusFor } from "../dates";

describe("datesIn", () => {
  it("reads explicit calendar dates", () => {
    expect(datesIn("Proposals are due April 30, 2025 at 3:00 PM")).toEqual(["2025-04-30"]);
    expect(datesIn("Questions by 2 April 2025")).toEqual(["2025-04-02"]);
  });

  it("ignores relative phrases and dates without a year", () => {
    expect(datesIn("within 10 days from award")).toEqual([]);
    expect(datesIn("two weeks after notice of selection")).toEqual([]);
    expect(datesIn("due on April 30")).toEqual([]);
  });
});

describe("resolveDate", () => {
  it("keeps a correct model date", () => {
    expect(resolveDate("April 30, 2025", "2025-04-30", "due April 30, 2025")).toEqual({ iso: "2025-04-30" });
  });

  it("overrides a wrong model date with the date as written", () => {
    const r = resolveDate("April 30, 2025", "2025-03-30", "due April 30, 2025");
    expect(r.iso).toBe("2025-04-30");
    expect(r.note).toMatch(/corrected/);
  });

  it("returns no date for relative deadlines", () => {
    expect(resolveDate("within 10 days from award", "", "within 10 days from award").iso).toBe("");
  });
});

describe("statusFor", () => {
  const now = new Date(2026, 10, 24, 15, 0);

  it("flags past dates as expired", () => {
    expect(statusFor("2025-04-30", now)).toMatchObject({ status: "expired" });
    expect(statusFor("2026-11-23", now)).toEqual({ status: "expired", days: -1 });
  });

  it("handles today and upcoming dates", () => {
    expect(statusFor("2026-11-24", now)).toEqual({ status: "today", days: 0 });
    expect(statusFor("2026-12-01", now)).toEqual({ status: "upcoming", days: 7 });
  });

  it("treats missing dates as undated", () => {
    expect(statusFor("Not stated", now)).toEqual({ status: "undated", days: null });
  });
});

describe("markSuperseded", () => {
  const d = (kind: string, what: string, superseded = false) => ({ kind, what, superseded });

  it("marks the original date when a later one is labelled as revised by an addendum", () => {
    const out = markSuperseded([
      d("proposal_due", "Proposals due (original)"),
      d("proposal_due", "Proposals due (revised by Addendum No. 1)"),
      d("questions_due", "Written questions due"),
    ]);
    expect(out.map((x) => x.superseded)).toEqual([true, false, false]);
  });

  it("marks the plain earlier entry when only the later one says it was revised", () => {
    const out = markSuperseded([
      d("proposal_due", "Proposals due"),
      d("proposal_due", "Proposals due, extended"),
    ]);
    expect(out.map((x) => x.superseded)).toEqual([true, false]);
  });

  it("leaves unrelated dates of the same kind alone", () => {
    const out = markSuperseded([
      d("pre_proposal_conference", "Deadline to request the meeting link"),
      d("pre_proposal_conference", "Pre-proposal conference"),
      d("other", "Answers posted"),
      d("other", "Finalist demonstrations"),
    ]);
    expect(out.every((x) => !x.superseded)).toBe(true);
  });

  it("keeps a flag the model already set", () => {
    expect(markSuperseded([d("proposal_due", "Proposals due", true)])[0].superseded).toBe(true);
  });
});

describe("deadlineStatus", () => {
  const now = new Date(2026, 10, 24, 9, 0);

  it("shows a replaced date as superseded, never upcoming or expired", () => {
    expect(deadlineStatus({ date: "2027-01-08", kind: "proposal_due", superseded: true }, now).status).toBe(
      "superseded",
    );
    expect(deadlineStatus({ date: "2025-01-08", kind: "proposal_due", superseded: true }, now).status).toBe(
      "superseded",
    );
  });

  it("treats a past issue date as history, not a missed deadline", () => {
    expect(deadlineStatus({ date: "2026-11-20", kind: "issued", superseded: false }, now)).toEqual({
      status: "passed",
      days: -4,
    });
    expect(deadlineStatus({ date: "2026-11-20", kind: "questions_due", superseded: false }, now).status).toBe(
      "expired",
    );
  });
});
