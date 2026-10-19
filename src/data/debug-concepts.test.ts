import { describe, expect, it } from "vitest";
import curriculum from "@/data/curriculum.json";
import debug from "@/data/debug.json";
import { CONCEPTS } from "./debug-concepts";

const days = new Map(
  curriculum.weeks.flatMap((w) => w.days.map((d) => [`${w.number}:${d.numberInWeek}`, d] as const)),
);

describe("debug concept map", () => {
  it("only links to days that exist, and the slot it names has a title", () => {
    for (const [tag, c] of Object.entries(CONCEPTS)) {
      expect(c.days.length, tag).toBeGreaterThan(0);
      for (const d of c.days) {
        const row = days.get(`${d.week}:${d.day}`);
        expect(row, `${tag} -> week ${d.week} day ${d.day}`).toBeDefined();
        const title = d.slot === "main" ? row!.title : d.slot === "dsa" ? row!.dsaTitle : row!.sweTitle;
        expect(title?.length, `${tag} -> week ${d.week} day ${d.day} ${d.slot}`).toBeGreaterThan(0);
      }
    }
  });

  it("knows every concept tag the scenarios use", () => {
    for (const s of debug)
      for (const tag of s.concepts) expect(CONCEPTS[tag], `${s.id}: ${tag}`).toBeDefined();
  });
});
