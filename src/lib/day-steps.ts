// A day is up to five short pages, one topic each. The order below is the suggested order, not a rule.
const ALL_STEPS = [
  { slug: "learn", label: "Learn", minutes: 45, blurb: "Read and watch the sources picked for today" },
  { slug: "build", label: "Build", minutes: 60, blurb: "Make something small that works" },
  { slug: "dsa", label: "DSA", minutes: 60, blurb: "Practice problems in Python" },
  {
    slug: "engineering",
    label: "Engineering",
    minutes: 15,
    blurb: "One habit that makes you better at the craft",
  },
  { slug: "check", label: "Check", minutes: 10, blurb: "Answer from memory and write it down" },
] as const;

export type StepSlug = (typeof ALL_STEPS)[number]["slug"];

// The DSA step is switched off for now: it is hidden from every day, its page is not generated and its
// problems no longer count towards a day's progress. The data is untouched. To bring it back, remove "dsa"
// from HIDDEN_STEPS.
const HIDDEN_STEPS: StepSlug[] = ["dsa"];
/** False while the DSA step is hidden; pages that mention DSA check this. */
export const DSA_ENABLED = !HIDDEN_STEPS.includes("dsa");
export const STEPS: readonly (typeof ALL_STEPS)[number][] = ALL_STEPS.filter(
  (x) => !HIDDEN_STEPS.includes(x.slug),
);
export const isStep = (s: string): s is StepSlug => STEPS.some((x) => x.slug === s);
export const stepHref = (week: number, day: number, slug: StepSlug) => `/day/${week}/${day}/${slug}`;

/**
 * Lesson pages are prerendered only for the first weeks, where new visitors land. The rest render on first
 * visit and are then cached, which keeps each deployment's build output small (every day page is ~170 KB of HTML
 * plus its RSC payloads, and Vercel keeps a copy for every deployment).
 */
export const PRERENDER_WEEKS = 2;
