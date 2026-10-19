import data from "@/data/debug.json";
import { scenarioSchema, type Scenario } from "./debug-types";

const ALL: Scenario[] = scenarioSchema.array().parse(data);

/** What a page may hand to the browser: everything except the answer key. */
export type PublicScenario = Pick<
  Scenario,
  | "id"
  | "title"
  | "domain"
  | "concept"
  | "difficulty"
  | "symptom"
  | "files"
  | "failingTest"
  | "regressionTests"
> & { transcript?: { turns: Turn[] } };

type Turn = NonNullable<Scenario["transcript"]>["turns"][number];

export type AnswerKey = Pick<Scenario, "rootCause" | "correctFix" | "grading"> & {
  verdict?: string;
  kind?: string;
};

export const DOMAIN_LABEL: Record<Scenario["domain"], string> = {
  graph: "Graphs and state",
  simulation: "Simulation and rules",
  snippet: "Small snippets",
  "build-optimize": "Build, then optimize",
  pipeline: "Data pipelines",
  dbms: "Databases",
  oop: "Object-oriented design",
  os: "OS and concurrency",
  network: "Networking",
  rag: "RAG and LLM",
  "agent-review": "Reviewing agents",
};

export const allScenarios = () => ALL;
export const getScenario = (id: string) => ALL.find((s) => s.id === id);

export function toPublic(s: Scenario): PublicScenario {
  return {
    id: s.id,
    title: s.title,
    domain: s.domain,
    concept: s.concept,
    difficulty: s.difficulty,
    symptom: s.symptom,
    files: s.files,
    failingTest: s.failingTest,
    regressionTests: s.regressionTests,
    // The agent's turns are what the reviewer reads; the verdict and kind stay on the server.
    ...(s.transcript ? { transcript: { turns: s.transcript.turns } } : {}),
  };
}

export function answerKey(s: Scenario): AnswerKey {
  return {
    rootCause: s.rootCause,
    correctFix: s.correctFix,
    grading: s.grading,
    ...(s.transcript ? { verdict: s.transcript.verdict, kind: s.transcript.kind } : {}),
  };
}

/** What the workbench page may hand to the browser. Never the answer key, and not the agent's transcript. */
export type WorkbenchScenario = Pick<
  Scenario,
  "id" | "title" | "symptom" | "difficulty" | "files" | "failingTest" | "regressionTests"
>;

export function toWorkbench(s: Scenario): WorkbenchScenario {
  return {
    id: s.id,
    title: s.title,
    symptom: s.symptom,
    difficulty: s.difficulty,
    files: s.files,
    failingTest: s.failingTest,
    regressionTests: s.regressionTests,
  };
}
