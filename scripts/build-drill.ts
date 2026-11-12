// Usage: npm run drill:build   (writes src/data/striver-drill.json; keeps entries already there, so re-runs fill gaps)
// The model drafts the card bank once; a person checks it. Nothing here runs at request time.
import fs from "node:fs";
import path from "node:path";
import { DRILL_PATTERNS, type DrillEntry } from "../src/lib/drill-types";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* env already set */
}

type Problem = { id: number; label: string; topic: string; subtopic: string; leetcodeLink?: string | null };
const problems: Problem[] = JSON.parse(fs.readFileSync("src/data/striver-180.json", "utf8"));
const out = path.resolve("src/data/striver-drill.json");
const have: Record<string, DrillEntry> = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {};

const key = process.env.TOKEN_API_KEY;
if (!key) throw new Error("TOKEN_API_KEY is not set");
const base = (process.env.TOKEN_BASE_URL || "https://tokenharbor.ai/v1").replace(/\/+$/, "");
const model = process.env.TOKEN_REVIEW_MODEL || process.env.TOKEN_MODEL || "deepseek-v4.1-flash:free";
const BATCH = 8;

const system =
  "You write revision flashcards for well-known DSA interview problems. For each problem produce a JSON object with: " +
  '"idea" (the key insight in one or two sentences, no code), "brute" (the obvious first attempt and why it is too slow or wrong, one sentence), ' +
  `"pattern" (exactly one of: ${DRILL_PATTERNS.join("; ")}), "time" and "space" (the optimal solution's complexity in big-O, like "O(n log n)"; ` +
  'use the standard variable names n, m, V, E, k), "whyComplexity" (one sentence), "pitfall" (the edge case or mistake that most often breaks a solution, one sentence). ' +
  "Be exact and specific to the problem, and describe the standard optimal approach. " +
  'Reply with only JSON: {"<problem id>": {...}, ...}.';

async function ask(batch: Problem[]): Promise<Record<string, Partial<DrillEntry>>> {
  const list = batch.map((p) => `${p.id}: ${p.label} (${p.topic} > ${p.subtopic}) ${p.leetcodeLink ?? ""}`).join("\n");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 6000,
          messages: [
            { role: "system", content: system },
            { role: "user", content: list },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text: string = (await res.json())?.choices?.[0]?.message?.content ?? "";
      return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    } catch (e) {
      console.error(`  attempt ${attempt} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return {};
}

const str = (v: unknown, max = 500) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function clean(id: number, v: Partial<DrillEntry> | undefined): DrillEntry | null {
  if (!v) return null;
  const idea = str(v.idea), brute = str(v.brute), time = str(v.time, 40), space = str(v.space, 40);
  const why = str(v.whyComplexity), pitfall = str(v.pitfall);
  const pattern = (DRILL_PATTERNS as readonly string[]).includes(v.pattern as string) ? (v.pattern as string) : null;
  if (!idea || !brute || !time || !space || !why || !pitfall || !pattern) return null;
  return { id, idea, brute, pattern, time, space, whyComplexity: why, pitfall };
}

async function main() {
  const todo = problems.filter((p) => !have[p.id]);
  console.log(`${todo.length} problems to write (${Object.keys(have).length} already there)`);
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const got = await ask(batch);
    let ok = 0;
    for (const p of batch) {
      const e = clean(p.id, got[String(p.id)]);
      if (e) {
        have[p.id] = e;
        ok++;
      }
    }
    fs.writeFileSync(out, JSON.stringify(have, null, 1) + "\n");
    console.log(`batch ${i / BATCH + 1}: ${ok}/${batch.length}`);
  }
  const missing = problems.filter((p) => !have[p.id]).map((p) => p.id);
  console.log(missing.length ? `Missing: ${missing.join(", ")} (run again)` : "Bank complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
