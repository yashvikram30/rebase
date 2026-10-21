/** The platform's name. The offerings below are separate products that share only sign-in, sync and theme. */
export const PLATFORM = "Rebase";

export type ProductId = "learn" | "debug";

export type ProductMode = { name: string; text: string; href: string };

export type Product = {
  id: ProductId;
  name: string;
  href: string;
  tagline: string;
  /** Hub-page copy: what the offering is, who it is for, and the ways to use it. */
  title: string;
  blurb: string;
  action: string;
  modes: readonly ProductMode[];
};

/** Each offering the header tabs and the platform home list. A new product is a new entry here plus its own route group. */
export const PRODUCTS: readonly Product[] = [
  {
    id: "learn",
    name: "Learn",
    href: "/learn",
    tagline: "A 16-week CS course in Python",
    title: "Learn: the daybook",
    blurb:
      "A free, sixteen-week course. Each day is four short pages: learn, build, engineering and a check. Start at the machine, end with an AI system you built yourself.",
    action: "Open Learn",
    modes: [
      { name: "Today", text: "Your next day, your streak and your schedule.", href: "/learn" },
      { name: "Revise", text: "A shuffled question set from the weeks you pick.", href: "/revise" },
      { name: "Notes", text: "Linked notes with tags, kept in your browser.", href: "/notes" },
      { name: "Schedule", text: "All 64 days with dates. Reschedule if you fall behind.", href: "/schedule" },
    ],
  },
  {
    id: "debug",
    name: "Debug",
    href: "/debug",
    tagline: "Practice AI-enabled debugging rounds",
    title: "Debug: the AI IDE interview",
    blurb:
      "Interviewers hand you broken code and a failing test, then watch how you work with an assistant. Practice reproducing, reasoning, making the smallest fix and checking you broke nothing else.",
    action: "Open Debug",
    modes: [
      {
        name: "Workbench",
        text: "Fix the bug in an editor with a test runner and terminal.",
        href: "/debug",
      },
      { name: "With an assistant", text: "The same workbench with a limited chat to an AI.", href: "/debug" },
      {
        name: "Review an agent",
        text: "Read an agent's patch, run it and decide to approve.",
        href: "/debug",
      },
      { name: "Random round", text: "A case with its title hidden until you finish.", href: "/debug/random" },
    ],
  },
];

export const productName = (id: ProductId) => PRODUCTS.find((p) => p.id === id)?.name ?? id;
