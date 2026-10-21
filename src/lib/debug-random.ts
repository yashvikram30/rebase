import { createHash } from "node:crypto";
import { allScenarios } from "./debug";

/**
 * An address for a case that does not say what it is. Random draws open at /debug/random/<slug>, so the
 * URL, like the title, must not give away the topic before the case is finished.
 */
export const blindSlug = (id: string) =>
  createHash("sha1").update(`rebase-random:${id}`).digest("hex").slice(0, 10);

export const scenarioFromSlug = (slug: string) => allScenarios().find((s) => blindSlug(s.id) === slug);
