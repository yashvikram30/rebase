import { z } from "zod";

// A fix is a full replacement of some of the scenario's files (path -> new source), not a diff.
// That keeps validation trivial: overlay it on `files` and run the test suites.
const fileMap = z.record(z.string().min(1), z.string());

const transcriptTurn = z.object({
  role: z.enum(["user", "agent", "tool"]),
  text: z.string().min(1),
  // Present when the agent proposes a change in this turn.
  fix: fileMap.optional(),
});

export const scenarioSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  // Hidden in random mode until the user submits.
  domain: z.enum([
    "graph",
    "simulation",
    "snippet",
    "build-optimize",
    "pipeline",
    "dbms",
    "oop",
    "os",
    "network",
    "rag",
    "agent-review",
  ]),
  concept: z.string().min(1),
  // Tags that map to course days (src/data/debug-concepts.ts). Used for recommendations, never shown up front.
  concepts: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  // What the user sees up front. Names the symptom, never the cause.
  symptom: z.string().min(1),
  files: fileMap,
  // unittest module sources. Both import from the files above.
  failingTest: z.string().min(1),
  regressionTests: z.string().min(1),
  rootCause: z.string().min(1),
  correctFix: fileMap,
  // Plausible fixes that pass failingTest but break regressionTests.
  wrongFixes: z.array(z.object({ fix: fileMap, whyWrong: z.string().min(1) })),
  // Pre-written agent session for review mode.
  transcript: z
    .object({
      kind: z.enum(["correct", "subtle-wrong", "confident-wrong"]),
      turns: z.array(transcriptTurn).min(1),
      // What a good reviewer should have caught.
      verdict: z.string().min(1),
    })
    .optional(),
  grading: z.array(z.object({ question: z.string().min(1), ideal: z.string().min(1) })).min(1),
});

export type Scenario = z.infer<typeof scenarioSchema>;
