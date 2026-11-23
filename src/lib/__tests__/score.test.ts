import { describe, expect, it } from "vitest";
import { decide } from "../score";

describe("decide", () => {
  it("bids on a strong fit with no blockers", () => {
    expect(decide({ impacts: [3, 2, 0], dealBreakers: 0, workCategory: "software_development" })).toEqual({
      fitScore: 10,
      decision: "BID",
      fastNoBid: false,
    });
  });

  it("starts from 5 and needs 6 to bid", () => {
    expect(decide({ impacts: [], dealBreakers: 0, workCategory: "it_services" }).decision).toBe("NO_BID");
    expect(decide({ impacts: [1], dealBreakers: 0, workCategory: "it_services" }).decision).toBe("BID");
  });

  it("caps the score and forces no-bid when there is a deal-breaker", () => {
    const r = decide({ impacts: [3, 3], dealBreakers: 1, workCategory: "software_development" });
    expect(r).toMatchObject({ fitScore: 3, decision: "NO_BID" });
  });

  it("gives a fast no-bid for construction", () => {
    const r = decide({ impacts: [3, 3], dealBreakers: 0, workCategory: "construction_or_facilities" });
    expect(r).toEqual({ fitScore: 2, decision: "NO_BID", fastNoBid: true });
  });

  it("keeps the score between 0 and 10", () => {
    expect(decide({ impacts: [-3, -3, -3], dealBreakers: 0, workCategory: "other" }).fitScore).toBe(0);
    expect(decide({ impacts: [3, 3, 3], dealBreakers: 0, workCategory: "other" }).fitScore).toBe(10);
  });
});
