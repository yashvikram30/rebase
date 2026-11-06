import { describe, expect, it } from "vitest";
import { parseQuestions } from "./interview-questions";

describe("parseQuestions", () => {
  const ids = new Set([1, 2]);
  it("reads fenced JSON, drops unknown ids and non-strings, and caps each group", () => {
    const reply =
      '```json\n{"1": {"followups": ["a?", " ", 5, "b?", "c?", "d?", "e?", "f?"], "variations": ["v1", "v2"]}, "9": {"followups": ["x"]}, "2": "nope"}\n```';
    expect(parseQuestions(reply, ids)).toEqual({
      1: { followups: ["a?", "b?", "c?", "d?", "e?"], variations: ["v1", "v2"] },
    });
  });
  it("keeps a problem that only has one group", () => {
    expect(parseQuestions('{"2": {"variations": ["v"]}}', ids)).toEqual({ 2: { followups: [], variations: ["v"] } });
  });
  it("returns nothing for junk", () => {
    expect(parseQuestions("sorry, no", ids)).toEqual({});
    expect(parseQuestions(undefined, ids)).toEqual({});
    expect(parseQuestions("{bad", ids)).toEqual({});
  });
});
