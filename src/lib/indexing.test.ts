import { describe, expect, it } from "vitest";
import { isIndexable } from "./indexing";

describe("isIndexable", () => {
  it("is false when SITE_INDEXABLE is unset", () => {
    expect(isIndexable({})).toBe(false);
  });

  it.each(["", "1", "TRUE", "yes", "True", " true", "false"])("is false for %j", (v) => {
    expect(isIndexable({ SITE_INDEXABLE: v })).toBe(false);
  });

  it('is true only for exactly "true"', () => {
    expect(isIndexable({ SITE_INDEXABLE: "true" })).toBe(true);
  });
});
