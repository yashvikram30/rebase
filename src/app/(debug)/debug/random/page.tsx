import type { Metadata } from "next";
import { RandomClient } from "@/components/debug/random-client";
import { allScenarios } from "@/lib/debug";
import { blindSlug } from "@/lib/debug-random";
import "../../debug.css";

export const metadata: Metadata = {
  title: "Random draw",
  description: "A debugging case drawn at random, with its topic hidden until you finish.",
};

export default function RandomPage() {
  const cases = allScenarios().map((s) => ({ id: s.id, slug: blindSlug(s.id), difficulty: s.difficulty }));
  return (
    <article className="dbg">
      <h1>Random draw</h1>
      <p className="lead">
        In a real round you do not get to pick the bug or know what kind it is. Draw a case and find out. Its
        title and topic stay hidden until you finish the round and read your review.
      </p>
      <RandomClient cases={cases} />
    </article>
  );
}
