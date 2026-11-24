import { describe, expect, it } from "vitest";
import { InputError, analyzeRfp } from "../analyze";

describe("analyzeRfp input checks", () => {
  it("rejects a document with no readable text before calling any model", async () => {
    await expect(analyzeRfp({ pages: ["", "  "], fileName: "scan.pdf" })).rejects.toBeInstanceOf(InputError);
  });

  it("rejects a document that is too large", async () => {
    const pages = Array.from({ length: 301 }, () => "x".repeat(300));
    await expect(analyzeRfp({ pages, fileName: "huge.pdf" })).rejects.toBeInstanceOf(InputError);
  });
});
