// Usage: npm run debug:build   (validates data/debug/*.json and regenerates src/data/debug.json)
import fs from "node:fs";
import path from "node:path";
import { loadScenarios } from "./lib/debug";

const out = path.resolve(process.cwd(), "src/data/debug.json");
fs.writeFileSync(out, JSON.stringify(loadScenarios()) + "\n");
console.log("Wrote", path.relative(process.cwd(), out));
