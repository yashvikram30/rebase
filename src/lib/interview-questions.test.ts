import { describe, expect, it } from "vitest";
import { parseQuestions } from "./interview-questions";

describe("parseQuestions", () => {
  const ids = new Set([1, 2]);
  it("reads fenced JSON, drops unknown ids and non-strings, and caps the count", () => {
    const reply = '```json\n{"1": ["a?", " ", 5, "b?", "c?", "d?", "e?"], "9": ["x?"], "2": "nope"}\n```';
    expect(parseQuestions(reply, ids)).toEqual({ 1: ["a?", "b?", "c?", "d?"] });
  });
  it("returns nothing for junk", () => {
    expect(parseQuestions("sorry, no", ids)).toEqual({});
    expect(parseQuestions(undefined, ids)).toEqual({});
    expect(parseQuestions("{bad", ids)).toEqual({});
  });
});
