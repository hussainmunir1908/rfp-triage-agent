import { describe, expect, it } from "vitest";
import { joinTextItems } from "../pdf-text";

const item = (str: string, x: number, width: number, y = 700, hasEOL = false) => ({
  str,
  hasEOL,
  width,
  height: 10,
  transform: [10, 0, 0, 10, x, y],
});

describe("joinTextItems", () => {
  it("does not insert a space inside a word drawn as separate ligature items", () => {
    const items = [item("Paci", 100, 20), item("fi", 120, 6), item("c", 126, 5)];
    expect(joinTextItems(items)).toBe("Pacific");
  });

  it("keeps the space between separate words", () => {
    const items = [item("Proposals", 100, 45), item("due", 150, 16)];
    expect(joinTextItems(items)).toBe("Proposals due");
  });

  it("separates cells that are far apart on the same line and breaks lines at end of line", () => {
    const items = [item("Event", 50, 25), item("Date", 300, 20, 700, true), item("RFP issued", 50, 45, 680)];
    expect(joinTextItems(items)).toBe("Event Date\nRFP issued");
  });

  it("adds a space when the next item starts a new line without an end-of-line mark", () => {
    expect(joinTextItems([item("first", 50, 25, 700), item("second", 50, 30, 680)])).toBe("first second");
  });
});
