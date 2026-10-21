import { z } from "zod";
import { MIN_HYPOTHESIS } from "./agent-constants";

export { MIN_HYPOTHESIS };

const turn = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(3000) });

/** What the page may send to the agent route. Sizes are capped so a request cannot be used to burn tokens. */
export const agentRequest = z.object({
  token: z.string().max(600),
  phase: z.enum(["explore", "fix"]),
  hypothesis: z.string().max(1500).optional(),
  messages: z.array(turn).min(1).max(12),
  files: z.record(z.string().max(80), z.string().max(30_000)).refine((f) => Object.keys(f).length <= 12),
  testOutput: z.string().max(6000).optional(),
});
export type AgentRequest = z.infer<typeof agentRequest>;

type Case = { title: string; symptom: string; failingTest: string };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const RULES = `You are the AI assistant in a timed debugging interview exercise. The candidate is fixing a bug in a small Python program and may chat with you. Their messages are limited, so make each reply count.

Rules:
- Be concise: about 150 words at most, unless you are showing code.
- You cannot run code. You only know what is in this conversation: the files, the failing test and the latest test output below. Never claim to have run anything.
- Be honest about uncertainty. If you are not sure, say so and suggest what to check.`;

const EXPLORE = `
- The candidate has NOT stated a hypothesis yet. Do not write corrected code or a patch, and do not describe the exact fix. Explain what the code does, help them read the test output, suggest what to inspect or print, and ask one question that helps them form a hypothesis.`;

const fix = (hypothesis: string) => `
- The candidate's hypothesis is: "${hypothesis}"
- You may now propose the smallest change that fixes the bug. Start with one to three sentences. If the hypothesis looks wrong, say so first.
- Then give the complete new contents of each file you change in a fenced block whose info line is exactly: \`\`\`python path=<filename>
- Only change files listed below. Do not change tests, and do not refactor unrelated code.`;

/** The conversation sent to the model. It sees the files and test output, never the case's answer key. */
export function buildMessages(req: AgentRequest, scenario: Case): ChatMessage[] {
  const files = Object.entries(req.files)
    .map(([name, code]) => `### ${name}\n\`\`\`python\n${code}\n\`\`\``)
    .join("\n\n");
  const system = [
    RULES + (req.phase === "fix" ? fix((req.hypothesis ?? "").trim()) : EXPLORE),
    `Bug report: ${scenario.title}. ${scenario.symptom}`,
    `Failing test (test_failing.py):\n\`\`\`python\n${scenario.failingTest}\n\`\`\``,
    `Current files:\n\n${files}`,
    req.testOutput ? `Latest test output:\n${req.testOutput}` : "No tests have been run yet.",
  ].join("\n\n");
  return [{ role: "system", content: system }, ...req.messages];
}

/** UTC calendar day, the key for the daily token budget. */
export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
