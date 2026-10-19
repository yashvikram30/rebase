"use server";
import { answerKey, getScenario, type AnswerKey } from "@/lib/debug";

/** The answer key stays on the server until the reviewer commits to a verdict. */
export async function revealAnswer(id: string): Promise<AnswerKey | null> {
  const s = typeof id === "string" ? getScenario(id) : undefined;
  return s ? answerKey(s) : null;
}
