import { describe, expect, it } from "vitest";
import { datesIn, resolveDate, statusFor } from "../dates";

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
