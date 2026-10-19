import type { Metadata } from "next";
import Link from "next/link";
import { getCurriculum } from "@/lib/curriculum";
import { DSA_ENABLED } from "@/lib/day-steps";

export const metadata: Metadata = { title: "Course" };

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

export default async function PlanPage() {
  const c = await getCurriculum();
  const phase = new Map(c.phases.map((p) => [p.slug, p]));
  const dayCount = c.weeks.reduce((n, w) => n + w.days.length, 0);
  return (
    <article>
      <h1>From the machine up to production systems and generative AI</h1>
      <p className="quiet">
        {c.weeks.length} weeks · 4 days a week · about {DSA_ENABLED ? 3 : 2} hours a day · {dayCount} days in
        all
      </p>
      <p className="lead">
        Each layer rests on the one below it. Every subject ends in something you build, break and explain.
      </p>
      <p className="plan-actions">
        <Link className="btn primary big" href="/start">
          Pick your start date
        </Link>
        <Link className="btn big" href="/day/1/1">
          Read day 1 first
        </Link>
      </p>
      <p className="quiet">
        New to programming? Begin with <Link href="/foundations">Part 0: Python Foundations</Link>, four
        optional weeks before day 1.
      </p>

      <h2 id="day">How a day works</h2>
      <p>
        Each day is {DSA_ENABLED ? "five" : "four"} short pages, one topic on each: learn, build,{" "}
        {DSA_ENABLED && "DSA, "}engineering and a check.
      </p>
      <div className="cols">
        {DSA_ENABLED && (
          <div>
            <h3>DSA, 1 hour</h3>
            <p>
              Problems from Striver&apos;s A2Z sheet, solved in Python, in the sheet&apos;s order. Watch the
              short lecture for the pattern first. Easy and medium problems are the target; hard ones are
              marked as stretch.
            </p>
          </div>
        )}
        <div>
          <h3>Main track, 1 hour 45 minutes</h3>
          <p>
            About 45 minutes to learn from the linked sources, then an hour to build. The build is the point:
            read less than you think you need.
          </p>
        </div>
        <div>
          <h3>Engineering slot, 15 minutes</h3>
          <p>
            One short reading on a software engineering practice that matches the week, plus your notes on
            what broke and why.
          </p>
        </div>
      </div>

      <h2 id="week">How a week works</h2>
      <ol className="plain">
        <li>
          <b>Day 1:</b> concepts and a small experiment.
        </li>
        <li>
          <b>Day 2:</b> concepts and the design of the project.
        </li>
        <li>
          <b>Day 3:</b> build day.
        </li>
        <li>
          <b>Day 4:</b> finish, break it on purpose, write the weekly note, answer the check questions from
          memory.
        </li>
      </ol>

      <h2 id="weeks">The {c.weeks.length} weeks</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Topic</th>
              <th scope="col">Subject</th>
              <th scope="col">Language</th>
              <th scope="col">Project</th>
            </tr>
          </thead>
          <tbody>
            {c.weeks.map((w) => (
              <tr key={w.number}>
                <td>W{w.number}</td>
                <td>
                  <Link href={`/week/${w.number}`}>{w.title}</Link>
                </td>
                <td>{phase.get(w.phase)?.name}</td>
                <td>{phase.get(w.phase)?.language}</td>
                <td>{w.project}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="tracks">Tracks that run the whole time</h2>
      <div className="cols">
        {DSA_ENABLED && (
          <div>
            <h3>DSA</h3>
            <p>
              Striver&apos;s A2Z sheet in its own order: sorting, arrays, hashing, binary search, strings,
              greedy, sliding window and two pointers, stacks and queues, binary trees, binary search trees,
              graphs and dynamic programming. About 277 problems over {dayCount} days. Two changes make it
              spiral instead of strictly blocked: hashing comes before Two Sum, and dynamic programming comes
              before the advanced graph days (strongly connected components, bridges, Floyd-Warshall), so the
              most asked topics are done before the capstone. The lectures use C++ or Java; the ideas carry
              over, and you write every solution in Python.
            </p>
          </div>
        )}
        <div>
          <h3>Software engineering</h3>
          <p>
            Every day has a 15-minute slot: git, debugging, testing, code review, API design, resilience,
            observability. Week 11 is a full week on design, testing, APIs and delivery, applied to your own
            code.
          </p>
        </div>
        <div>
          <h3>Machine learning and generative AI</h3>
          <p>
            Weeks 12 to 16: the math and honest evaluation, neural networks from scratch, transformers and how
            LLMs are trained and served, building software on LLMs with tools and evals, retrieval-augmented
            generation end to end, then a capstone that joins it to your own systems.
          </p>
        </div>
      </div>

      <h2 id="python">Python first, from the basics</h2>
      <p>
        The whole plan is written in Python, including the architecture and operating-systems weeks. The
        operating-systems days pair the OSTEP chapters with Neso Academy and Gate Smashers videos, so the
        textbook algorithms (scheduling, page replacement, banker&apos;s algorithm, disk scheduling) are all
        covered and each one gets a small simulator. The networking days do the same with Neso Academy and
        Gate Smashers: Ethernet and ARP, subnetting, routing algorithms, ARQ protocols and the TCP header. The
        database and distributed-systems days add Gate Smashers for the textbook algorithms (serializability,
        locking, joins, quorums), and the machine learning and generative AI weeks pair papers with StatQuest,
        Krish Naik, Karpathy, 3Blue1Brown and Google&apos;s own ML and Gemini material. Each of the first
        sixteen days opens with one numbered Python lesson (the official tutorial, then PEP 8 and pytest, in
        that order), so you learn the language while you use it. The first three days also start from the
        basics, with a short warm-up. Python is the only language in the plan; where it hides the machine,
        built-in modules such as <code>ctypes</code>, <code>dis</code> and <code>mmap</code> show what is
        underneath. <Link href="/python">See the Python path</Link>.
      </p>

      <h2 id="lab">The optional fifth day</h2>
      <p>
        Every week has a revision lab that you can take on a rest day or skip. It opens with a review round of
        questions from this week and earlier ones, scheduled so what you recall comes back after a day, three
        days, a week and two weeks. Then come four hands-on exercises tied to that week&apos;s project, a list
        of problems you left unchecked, and one problem to redo from scratch. It never changes your schedule.
      </p>

      <h2 id="month">The monthly review</h2>
      <p>
        After every fourth week there is a longer, optional review. It has a bigger review round and four
        exercises that join the month&apos;s work into one piece. From month 2 on it also reaches back: the
        round draws on every earlier month, and two extra exercises reopen work you did before. Skip it
        whenever you like; nothing in your schedule depends on it.
      </p>

      <h2 id="brain">Second brain</h2>
      <p>
        Each day ends with a journal. For anything longer, the notes page is a small knowledge base: write in
        Markdown, link notes to each other and to any day with <code>[[double brackets]]</code>, tag them with{" "}
        <code>#tags</code>, tick off checklists, and export everything as Markdown. It all stays in your
        browser, and your backup file includes it.
      </p>

      <h2 id="rules">Rules that keep it on track</h2>
      <ul className="plain">
        <li>
          <b>Definition of done:</b> the project runs, has tests, and you have written down one failure you
          caused and explained.
        </li>
        <li>
          <b>If a week overruns, cut project scope.</b> Do not push the schedule; later weeks depend on the
          momentum.
        </li>
        <li>
          <b>Weekly review:</b> answer the check questions from memory before opening any notes. Mark the ones
          you could not.
        </li>
        {DSA_ENABLED && (
          <li>
            <b>DSA: attempt before you watch the solution.</b> Give each problem 20 minutes, then read or
            watch the answer, close it, and write it again from memory. Do the hard ones after the plan if
            time is short.
          </li>
        )}
        <li>
          <b>Commit daily.</b> Your git history is the record that you did the work.
        </li>
      </ul>

      <h2 id="setup">Set up before day 1</h2>
      <ul className="plain">
        <li>
          Use <code>pdb</code> as your debugger. Expect to read a little ARM64 assembly in week 1 when you
          compare it with Python bytecode.
        </li>
        <li>
          Weeks 3 and 4 need real Linux for <code>strace</code>, <code>/proc</code> and fork behaviour. Use{" "}
          <a href="https://lima-vm.io/" {...ext}>
            Lima
          </a>{" "}
          or{" "}
          <a href="https://docs.docker.com/desktop/setup/install/mac-install/" {...ext}>
            Docker Desktop
          </a>
          .
        </li>
        <li>
          Install{" "}
          <a href="https://docs.astral.sh/uv/" {...ext}>
            uv
          </a>{" "}
          and Python 3.13 on day 1.
        </li>
        <li>
          Run Postgres through the{" "}
          <a href="https://hub.docker.com/_/postgres" {...ext}>
            official Docker image
          </a>{" "}
          in week 8.
        </li>
      </ul>

      <div className="callout">
        <b>What this does not cover</b>
        Compilers and language runtimes, formal security, and deeper math are only touched. Treat this as a
        first pass with one real project per subject, then pick the subject you enjoyed most and go deeper.
        The last day of the plan helps you choose.
      </div>
    </article>
  );
}
