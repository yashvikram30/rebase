import fs from "node:fs";
import path from "node:path";
import { scenarioSchema, type Scenario } from "../../src/lib/debug-types";

const dir = path.resolve(process.cwd(), "data/debug");

export function loadScenarios(): Scenario[] {
  const out = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const parsed = scenarioSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
      if (`${parsed.id}.json` !== f) throw new Error(`${f}: id "${parsed.id}" must match the file name`);
      return parsed;
    });
  const ids = new Set(out.map((s) => s.id));
  if (ids.size !== out.length) throw new Error("duplicate scenario id");
  return out;
}
