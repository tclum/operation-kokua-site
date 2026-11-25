import { describe, expect, it } from "vitest";
import { unconfirmed } from "@/content/unconfirmed";
import { assertLaunchReady, launchGateError } from "./launch-gate";

const LIST = [
  { label: "Impact figure: about $50 million", basis: "david-unconfirmed" },
  { label: "Legal line: EIN", basis: "public-record" },
];

describe("launch gate", () => {
  it("throws when indexable with a non-empty unconfirmed list, naming every item", () => {
    expect(() => assertLaunchReady({ SITE_INDEXABLE: "true" }, LIST)).toThrow(/Launch gate/);
    const msg = launchGateError({ SITE_INDEXABLE: "true" }, LIST) ?? "";
    for (const item of LIST) expect(msg).toContain(item.label);
  });

  it("passes when not indexable, with the same list", () => {
    expect(() => assertLaunchReady({}, LIST)).not.toThrow();
    expect(() => assertLaunchReady({ SITE_INDEXABLE: "false" }, LIST)).not.toThrow();
  });

  it("passes when indexable with an empty list", () => {
    expect(() => assertLaunchReady({ SITE_INDEXABLE: "true" }, [])).not.toThrow();
  });

  it("would stop today's content from going indexable", () => {
    expect(unconfirmed.length).toBeGreaterThan(0);
    expect(() => assertLaunchReady({ SITE_INDEXABLE: "true" }, unconfirmed)).toThrow();
  });
});
