import { describe, expect, it } from "vitest";
import { allScenarios } from "./debug";
import { blindSlug, scenarioFromSlug } from "./debug-random";

describe("blind slugs", () => {
  it("are stable, unique and find their case again", () => {
    const slugs = allScenarios().map((s) => blindSlug(s.id));
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of allScenarios()) {
      expect(blindSlug(s.id)).toBe(blindSlug(s.id));
      expect(scenarioFromSlug(blindSlug(s.id))?.id).toBe(s.id);
    }
  });

  it("do not contain anything from the case's name", () => {
    for (const s of allScenarios()) {
      const slug = blindSlug(s.id);
      expect(slug).toMatch(/^[0-9a-f]{10}$/);
      for (const word of s.id.split("-")) expect(slug.includes(word) && word.length > 3).toBe(false);
    }
  });

  it("do not match anything unknown", () => {
    expect(scenarioFromSlug("nope")).toBeUndefined();
  });
});
