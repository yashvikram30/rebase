# Technical decisions

A running record of the technical decisions in this codebase: what was chosen, why, what was turned down, and where
it lives. It is updated whenever a decision is made or changed. The **Changelog** at the bottom shows what moved.

Tags: **[built]** in the code now, **[planned]** agreed but not built, **[open]** not decided.

Context in one paragraph: Rebase is a platform of separate offerings on one Next.js 16 app. **Learn** is the 16-week
course; **Debug** is AI-enabled debugging-interview practice. User data is MongoDB; progress is local-first and
synced for signed-in users.

---

## 1. Application structure

- **[built] One thin root layout plus route groups.** `src/app/layout.tsx` holds only `<html>`, fonts, the theme
  script, global CSS, the page-view tracker, `SyncManager` and the toaster. Each offering brings its own shell in a
  group: `(learn)`, `(debug)`, `(account)` (Profile, Settings) and `(workbench)` (the full-window editor). `signin`
  and `analytics` stay at the top level as standalone screens. URLs are unchanged, since groups are not in the path.
  - Rejected: several root layouts. Navigating between them is a full page reload, and a 404 then needs the
    experimental `global-not-found` setting.
  - The root layout no longer loads the curriculum. Only `(learn)/layout.tsx` does, so Debug and account pages carry
    none of the course data.
- **[built] The platform home is `/`, a marketing page with its own top bar (`SiteHeader`).** It is the only page
  that pitches Rebase: a hero that asks the visitor to judge a real agent patch (`PatchReview`, built from the
  `account-lost-update` case), a continue block for returning visitors, counts read from the content, one row each
  for Learn and Debug, a course map and a footer.
- **[built] Inside the app, one sidebar is the only navigation (`AppSidebar`), and it is a drawer on every screen
  size.** It lists both products and their pages (Learn: Today, Course, Revise, Notes, Schedule; Debug: Cases,
  Random round), shows the course outline under Course on course pages, and keeps search, focus mode, theme and
  account at the bottom. The slim top bar (`MobileBar`) now shows everywhere: brand on the left, account menu and the
  hamburger on the right. The hamburger opens the sidebar from the right edge over a blurred scrim; it closes on
  navigation or Esc. `AppShell` (Learn) and `BareShell` (Debug, account) both use it. The drawer CSS is the last
  block of `theme.css`.
  - Chosen over a permanent sidebar after trying both with a switch: the content and the "On this page" column get
    about 280px more width, at the cost of one extra click to reach the course outline.
  - Rejected: header tabs for Learn and Debug with a second row of page links (three navigation surfaces and 100px
    of header for a two-product app), and a dropdown switcher (it hid the choice).
- **[built] Learn has no landing page of its own.** "Start the course" on the home page goes to the course overview
  (`/plan`), which leads with "Pick your start date". `/learn` is the Today dashboard, or a short "not started yet"
  state with the same actions. Picking a date no longer forces sign-in; guests keep the plan in this browser.
- **[built] A product registry** (`src/lib/products.ts`: id, name, href, tagline, hub copy and modes) feeds the home
  page and is the single list of offerings. Adding an offering is a route group plus one entry.
- **[built] Two shell components.** `AppShell` (Learn: sidebar, search, focus mode, quick capture) and `BareShell`
  (Debug and account pages: header only). `BareShell` sets `data-bare` and `data-product` so CSS can target it.
- **[built] Debug theming is scoped, not global.** Debug's palette and heading font are CSS custom properties under
  `.shell[data-product="debug"]` and `.wb`, with separate light and dark blocks (the app's theme uses both a
  `data-theme` attribute and a `prefers-color-scheme` media query, so Debug mirrors both). Learn and the account
  pages are untouched. Specificity is raised (`[data-bare]` plus `[data-product]`) so Debug rules beat the base theme
  regardless of stylesheet order.
- **[built] Next.js 16 constraints that shaped the code:**
  - `cacheComponents` is on, so a client component must not read time during prerender. The workbench's clock and
    start time use `useSyncExternalStore` with a server snapshot of 0, and a per-instance clock created lazily. A
    `useState(() => Date.now())` initialiser failed the production build.
  - The React compiler's purity lint rejects `Date.now()` in render and in handlers. A module-level `nowMs()` helper
    reads the clock outside the component.
  - Route params are async (`PageProps<"/route">`), and typed routes come from `next typegen`. Stale generated types
    in `.next/dev/types` must be cleared after moving routes.
  - Route handlers use POST (never cached), and `maxDuration` is set on the model-calling routes.
- **[built] Only the first two weeks of lesson pages are prerendered** (`PRERENDER_WEEKS` in `src/lib/day-steps.ts`,
  used by `generateStaticParams` for `/day/[n]/[d]` and `/day/[n]/[d]/[step]`). Prerendering every day left about
  234 MB of server output per build (about 173 MB for `/day`: roughly 320 step pages and 64 day pages at about
  170 KB of HTML each, plus RSC and segment files), and Vercel keeps a copy for every deployment, which added up to
  about 4.9 GB. With two weeks prerendered the output is about 87 MB (`/day` 22 MB). Later days render on first
  visit and are then cached. Deployment retention in Vercel should also be set to a short window.

## 1a. Visual design

- **[built] Tokens live in `globals.css`;** every colour and font goes through them, and the old names (`--hot`,
  `--plum`, `--amber`, `--display`) are kept as aliases so older rules pick up new values. Debug no longer has its own
  palette or typeface; it derives its diff colours from the shared tokens.
- **[built] Look: warm white, one bright orange, pressable buttons.** Bricolage Grotesque for headings, DM Sans for
  text and UI, DM Mono for code. Buttons have a solid bottom edge that shrinks when pressed. Text on orange is dark
  ink, because white on this orange fails contrast (about 2.9:1). Green and red mean pass and fail only.
  - Rejected after side-by-side comparison: a neutral "quiet tool" look (Geist, indigo) and a "textbook" look
    (Source Serif, teal). Earlier rejected by the user: plum and mustard with Fraunces, and IBM Plex with cobalt.

## 2. Content pipeline (the scenario library)

- **[built] Source and build.** One JSON file per scenario in `data/debug/`. `npm run debug:build`
  (`scripts/build-debug.ts`) validates every file with zod (`src/lib/debug-types.ts`) and writes the committed
  `src/data/debug.json`. A drift test fails if they disagree. The file name must equal the scenario id.
- **[built] A fix is a full replacement of files** (path to new source), not a diff. It overlays on the buggy files,
  so applying and testing it is trivial. Diffs for display are computed later.
- **[built] Scenario record:** id, title, domain, a hidden concept sentence, concept tags, difficulty 1 to 3,
  symptom, buggy files, one failing test, a regression suite, root cause, correct fix, wrong fixes with why each is
  wrong, optional recorded agent session (`correct`, `subtle-wrong`, `confident-wrong`) and grading questions.
- **[built] A three-way check runs in the test suite** (`scripts/debug.test.ts`), spawning `python3 -m unittest`
  in a temp directory for each case: the buggy code fails the failing test; the correct fix passes both suites;
  each wrong fix passes the failing test and fails the regression suite. The regression suite need not pass on the
  buggy code, because some of its cases crash by design. This is what makes a "tempting but wrong" fix real: when I
  wrote one that was actually correct, the check failed and I reworked the scenario.
- **[built] The check runs the machine's `python3` (3.9) but production runs Python 3.12 (Pyodide),** so scenario code
  avoids `match` and `X | Y` types, and the concurrency cases were also run in the browser.
- **[built] Files are flat modules,** not packages, so the worker writes one directory and imports stay simple.
- **[built] Concurrency cases use a cooperative scheduler** (`sched.py`: `yield_control` via `types.coroutine`,
  `Lock`, `run_all` that steps coroutines round-robin and raises `Deadlock` after a turn limit). `asyncio.run` does
  not work in Pyodide, and a scheduler makes every interleaving deterministic, so the tests are not flaky.
- **[built] Cases imitate how real rounds present bugs.** Reports read like tickets or an interviewer's prompt, not a
  pre-isolated function call (some cases carry two tickets, as Retool-style rounds do). Bug types follow what
  candidates report from Meta's AI-enabled round, Stripe's bug squash and similar: a step limit hiding a missing
  visited set, money rounded to whole dollars, cursor pagination that drops rows, string flags parsed with bool(),
  late-binding closures, path traversal, removing from a list while iterating it, integer division, time zones.
- **[built] Every case has a recorded agent session** for review mode. About a quarter are sound fixes (the agent
  runs both suites) and the rest stop at the first green test, so a reviewer cannot score well by always rejecting.
  A test checks that the agent's final patch passes both suites exactly when the session's kind is `correct`.
- **[built] Multi-bug cases.** Seven cases (`*-three-bugs`) put three independent bugs in one small module, with
  one failing test per bug, so the workbench shows "0 of 3 passed" and the candidate has to work through them one at
  a time, as in the CoderPad rounds candidates describe (a codebase that starts with several failing tests, where
  fixing one often exposes the next). The wrong fix for each fixes every failing test but breaks a regression test,
  and an agent session that fixes only two of three and explains the third away is one of the recorded patterns.
  The three-way check in `scripts/debug.test.ts` is unchanged, and each case was also checked to fail every one of
  its three tests on the buggy code.
- **[built] Difficulty rubric** (`difficulty` 1 to 3, shown as Easy, Medium, Hard). Easy: one idea, one or two small
  files, the cause is findable by reading the code or the test. Medium: tracing state across files, domain
  knowledge (timezones, rounding, pagination, caches) or several independent bugs. Hard: interleavings or timing
  across components (races, deadlocks, rate limits, event time), where the obvious fix passes the visible test. The
  42 cases are 16 easy, 21 medium and 5 hard; 15 were re-rated down in October 2026 (for example the string-flag,
  late-binding and paginator cases to easy, and keyset pagination, LRU and the aliasing repository to medium).
- **[built] Concept tags map to course days** (`src/data/debug-concepts.ts`). Each link names a slot
  (`main`, `engineering`, `dsa`). A test checks that every day exists and that the slot has a title. DSA links are
  dropped while `DSA_ENABLED` is false, and a concept left with no visible link is omitted, so no one is sent to a
  page they cannot open.
- **[open] Real threads, sockets and `fork`** cannot run in the browser. Cases needing them are read-and-reason only,
  or wait for a server-side sandbox (E2B, Modal or Judge0).

## 3. The answer-key boundary

- **[built] `rootCause`, `correctFix`, `wrongFixes` and `grading` never go to the browser by default.** Pages use
  `toPublic` (review) or `toWorkbench` (workbench), which pick only safe fields (`src/lib/debug.ts`). The review page
  fetches the key with a server action (`revealAnswer`) after the user commits to a verdict. The workbench payload
  also leaves out the recorded agent session, because its patch is a hint.
- **[built] The regression suite is in the payload** (it has to run in the browser) but the UI never shows its code.
  A curious user can read it in the page data, which is acceptable for self-practice.
- **[built] The assistant never sees the key.** Only the post-round reviewer does.

## 4. In-browser sandbox

- **[built] Pyodide 0.27.7 from jsDelivr in a classic Web Worker** (`public/debug/pyodide-worker.js`). No server, no
  abuse surface, and `unittest` works. The app sets no CSP, so the CDN needs no changes.
- **[built] Worker protocol.** Request `{id, files, suite}` runs a unittest suite; `{id, kind: "exec", files, code}`
  runs a snippet. Response `{id, ok, output}`, plus a one-off `{ready: true}`. Each run writes files to
  `/work/<id>`, adds it to `sys.path`, removes the user's modules from `sys.modules` before and after, and deletes
  the files.
- **[built] Runaway code is killed with `worker.terminate()`** after 60 s for the first (cold, includes the Pyodide
  download) run and 8 s afterwards, then a fresh worker starts on the next run. Rejected: interrupting through
  `SharedArrayBuffer`, which needs COOP/COEP headers and would break cross-origin embeds.
- **[built] Runs are serialised through a promise queue** so one run's timeout cannot kill another run.
- **[built] REPL semantics for the terminal.** The code is parsed with `ast`; a final expression statement is
  evaluated and printed with `repr`. Names persist in one namespace until the file set changes (the session key is
  the JSON of the files), when it is rebuilt with `from <module> import *` for each non-test module. Syntax errors
  print with `format_exception_only`; runtime errors drop the runner's own traceback frame. An earlier version ran
  each command fresh with `eval`-then-`exec`, which chained a misleading SyntaxError into every traceback.
- **[built] Test output is parsed from `unittest -v`** (`src/lib/unittest-report.ts`) into per-test pass, fail,
  error and skip lines, with the raw output kept behind a disclosure.

## 5. Workbench and review UI

- **[built] CodeMirror 6, not Monaco.** It is much smaller, has no worker or CDN setup, and Python has no language
  server to make Monaco's extras worthwhile. The editor is created once; each file keeps its own `EditorState` in a
  map (undo history and cursor survive tab switches); external changes (reset, applied patch) dispatch a replace.
  Colours come from CSS variables so one highlight style serves light and dark. Python highlighting applies to
  `.py` only; the bug report wraps as prose.
- **[built] Virtual files.** `BUG_REPORT.md` (the symptom) and `test_failing.py` are read-only and generated; the
  rest are editable. The explorer shows changed files with a dot.
- **[built] Derived state instead of effects.** The files on screen are `edits ?? savedDraft ?? original`, computed
  during render. The saved draft comes from `useSyncExternalStore`, so there is no setState-in-effect and no
  hydration mismatch (the server snapshot is empty).
- **[built] Resizable grid with accessible splitters** (pointer capture, arrow keys, `role="separator"`). Live
  sizes are local state during a drag and committed to the store on release. Below 900 px the panes become a tab
  bar, and the layout is desktop-first.
- **[built] Run shortcuts** (Ctrl/Cmd+Enter, plus Shift for all tests) are bound in the editor keymap with highest
  priority (the default map uses Mod-Enter for a blank line) and also on `window`; the window handler ignores events
  the editor already handled.
- **[built] Solved means both suites pass,** and only the first solve time is stored.
- **[built] Line diff** is a longest-common-subsequence over lines (`src/lib/line-diff.ts`), collapsed to the
  changed lines plus two lines of context. It is quadratic, which is fine for files this small.
- **[built] The case list is a LeetCode-style table** (`DebugList`): a summary row (solved count and Easy, Medium,
  Hard progress), a toolbar (search, topic, difficulty and status filters, Next case, Random) and one compact row per
  case with status, number, title, topic, difficulty and a Review link. Difficulty 1-3 shows as Easy, Medium, Hard;
  the symptom text is a tooltip on the title so the list does not spoil the case. The filters are a custom
  `Select` (button plus listbox, arrow keys, Esc, click outside) styled with the site tokens instead of the native
  control. The "Ways to practice" section was removed.
- **[built] Review mode** runs the agent's patch against both suites, then collects an Approve or Request changes
  verdict. The answer is revealed by server action after that.

## 6. Random draw

- **[built] `/debug/random`** draws in the browser with a pure, tested picker (`src/lib/random-pick.ts`): unsolved
  cases weigh 4, solved cases 1, the last case is excluded when there is a choice, and `rng` is a parameter so the
  draw is testable.
- **[built] Opaque addresses.** A case opens at `/debug/random/<slug>`, where the slug is the first 10 hex characters
  of `sha1("rebase-random:" + id)` (`src/lib/debug-random.ts`, server only). A readable URL would reveal the topic.
  The tab title and the title bar say "Random case"; the report reveals the topic.
- **[built] The browser holds the id-to-slug list** to weight by solved state. That is the same level of hiding as
  the answer key: not visible in the interface or the URL.

## 7. The assistant (chat)

- **[built] Gateway.** Token Harbor, an OpenAI-compatible API (`POST {base}/chat/completions`). Config:
  `TOKEN_API_KEY` (secret), optional `TOKEN_BASE_URL` (default `https://tokenharbor.ai/v1`), `TOKEN_MODEL` (default
  `deepseek-v4.1-flash:free`), `TOKEN_REVIEW_MODEL`, `DEBUG_DAILY_TOKEN_BUDGET`. Verified live: every model lists
  `tool_call: true`; ids ending `:free` never charge the balance and any other id bills it; the model emits
  `reasoning_content` alongside `content`.
- **[built] No dependence on tool calling.** A patch is a fenced block labelled `path=<file>` holding the complete new
  file. This works with any model, including weak free ones. `splitReply` also accepts `path=` or a `# file:` line as
  the first line inside the block (seen from the model in practice). A path outside the editable files is plain
  code, never a patch.
- **[built] Round token** (`src/lib/debug-round.ts`): `base64url(JSON{rid, sid, exp, cap}) + "." +
base64url(HMAC-SHA256(payload, AUTH_SECRET))`, verified with `timingSafeEqual` and an expiry check. The cap is in
  the signed payload, so a modified client cannot raise it.
- **[built] Enforcement is server-side**, in this order: same-origin check (`sec-fetch-site`), body size cap (120 KB),
  zod validation, token verification, file names must belong to the case, last message must be from the user, patch
  phase needs a hypothesis of 20+ characters, per-address limits, daily token budget, then the message reservation.
- **[built] Message reservation is one atomic Mongo update:** `findOneAndUpdate({_id: rid, messages: {$lt: cap}},
{$inc: {messages: 1}, $setOnInsert: {exp}}, {upsert: true, returnDocument: "after"})`. When the round is full the
  filter fails, the upsert tries to insert a duplicate `_id`, and error 11000 means "cap reached". The message is
  refunded (`$inc: -1`, never below zero) if the model call fails.
- **[built] Limits.**

  | Limit                        | Value                                     |
  | ---------------------------- | ----------------------------------------- |
  | Messages per round           | 12, within a 45-minute token              |
  | Per address                  | 20 a minute, 150 a day                    |
  | Starting rounds, per address | 10 a minute                               |
  | Daily token budget, everyone | 400,000 (env), from the gateway's `usage` |
  | Review requests, per address | 3 a minute, 10 a day                      |

  Counters are fixed-window buckets (`{_id: key:bucket, n}`) with expiry indexes.

- **[built] The assistant gives hints, never fixes.** Two layers again: the prompt, and the server.
  - _Prompt_ (`src/lib/debug-agent.ts`): answer only what the last message asks (no unprompted analysis); use only
    the bug report, failing test, files, test output and the conversation; decline off-topic requests in one
    sentence; never write corrected code, a patch or the replacement for a line, and never state the root cause so
    plainly that the fix is obvious. Replies are about 80 words, no lists, at most one question.
  - _Hint ladder:_ the number of real questions the candidate has asked (greetings and thanks are not counted, see
    `isSmallTalk`) sets a ceiling on what may be revealed: 1 what the test expects versus what happens, 2 the file or
    function involved, 3 the kind of mistake and what to trace, 4 which part deserves the closest look. The ceiling
    applies only when they ask for help.
  - _Greetings:_ when the last message is only small talk, the model gets a minimal prompt with no code, test or bug
    report, so it cannot volunteer anything.
  - _Hypothesis box:_ "Check my hypothesis" sends the phase `fix` with the hypothesis; the assistant says whether it
    holds and what to re-check, without writing the change.
  - _Server:_ `withholdPatches` removes every patch block and every fenced block longer than 4 lines from every
    reply, in both phases. The prompt layer can be talked around, which is acceptable for self-practice; the server
    layer is what guarantees no fix reaches the page. The Apply patch UI remains for older recorded sessions.
- **[built] Opening a case starts a fresh conversation.** `Workbench` calls `resetChatLog` in a layout effect on
  mount, which empties the stored `messages`, so the log on screen and the history sent to the model both start
  empty (and the hint level restarts at 1). The round (token, cap, used), the event timeline and the report are
  kept: reopening must not refill the message budget, and the mentor report reads the timeline, not the message
  log. Closing and reopening the Assistant panel inside one visit keeps that visit's conversation.
- **[built] Fixed reply caps** (`src/lib/llm-limits.ts`, constants, not settings, never read from a request): chat
  1,000 tokens and 4,000 characters; the reviewer 4,000 tokens and 16,000 characters. **Measured:** the gateway
  applies `max_tokens` to the visible answer only, and thinking can exceed it (one reply used 1,268 tokens against
  1,000). So the character cut is the real limit on what is shown, and the daily token budget (which counts total
  usage) is the real limit on spend. A reply cut for length ends with a visible note, and an unfinished code block
  cannot be applied because the fence regex needs a closing fence.
- **[built] Errors.** Gateway 402 (account out of credit) returns a plain "unavailable" message and logs the cause;
  429 and 5xx return a "not counted, try again" message; each refunds the message. With no key the route answers 503.
- **[built] Replies are not streamed.** It keeps the caps and the tests simple, and a typical reply takes 3 to 10
  seconds.
- **[built] Conversation sent to the model:** a system message (rules, hint level, hypothesis state, bug report,
  failing test, current files, latest test output) plus the last 10 turns, each clipped to 3,000 characters.

## 8. The mentor report

- **[built] Pipeline** (`POST /api/debug/review`): validate (zod, discriminated union of event types, 250 KB cap),
  derive facts server-side from the events (`deriveFacts`), build the built-in report, then try the model. The page
  sends events and files only; numbers are recomputed.
- **[built] Facts** (`src/lib/debug-session.ts`): time to first run, edits before the first run, edits before the
  first patch request, hypotheses, patches applied, **blind patches** (applied and not followed by a run), regression
  runs, terminal commands, last run, **lazy finish** (failing test passes but the regression suite fails or never
  ran) and duration.
- **[built] The report is never blocked on the model.** No key, limits, storage error, gateway error, timeout or an
  unreadable reply all return the built-in rule-based report with a note. Only malformed or oversized requests
  return errors.
- **[built] The model's JSON is read leniently** (`extractReport`): the first `{` to the last `}`, then zod with
  `clip` transforms (long strings and surplus list items are trimmed, unknown ratings become "not shown"). Anything
  over the reviewer's character cap is rejected whole.
- **[built] Reconciliation.** If the facts say reproducing or verifying was weak, a "strong" from the model is
  replaced with the built-in rating, so the model writes the prose but cannot overrule measured facts.
- **[built] Prompt.** The answer key is included (the round is over). The candidate's timeline and explanation are
  passed as data in the user message, and the system message tells the model not to follow instructions inside them.
- **[built] Recommendations have two sources, labelled differently.** Course links come from the verified concept
  map. AI-suggested topics and videos are shown as a title, a reason and a search link, and the model's own URLs
  are discarded.
- **[built] The timeline records:** open, chat (user and agent), edit (file and line counts, one entry per file when
  its change moves), run, patch applied, terminal command, finish. A message that failed is removed from the
  timeline, so it does not look like a question that was asked.

## 9. Persistence and sync

- **[built] Local-first stores** via `createLocalStore` (localStorage, a snapshot cached in memory, cross-tab updates,
  a server snapshot for hydration). Each has a `normalize` that validates and caps whatever it reads.
- **[built] Keys.**

  | Key                       | Holds                                   | Synced |
  | ------------------------- | --------------------------------------- | ------ |
  | `csplan.debug`            | review results and solves               | yes    |
  | `csplan.debug.drafts`     | edited files and start time             | yes    |
  | `csplan.debug.chat`       | round token, messages, timeline, report | no     |
  | `csplan.workbench.layout` | pane sizes                              | no     |

  Synced keys go through the existing generic route and `SYNC_KEYS`, with a 12 MB value cap. Drafts are capped at
  200 KB each and 50 cases; chat messages at 4,000 characters each and 60 messages; the timeline at 400 events.

- **[built] Server storage** is MongoDB. Drizzle and Neon are only used for seeding, so nothing new goes there. New
  collections `agent_rounds`, `agent_days` and `agent_hits` have TTL indexes, so counters expire on their own.
- **[built] Development uses a separate database name** (`MONGODB_DB=daybook_dev`) so test writes never touch real
  data. The database is still named `daybook` in production on purpose: renaming it would orphan user data.
- **[open] The Mongo cluster is not reachable from the assistant's sandbox** (DNS lookup refused), so limit storage
  has only run against a test stand-in. It needs one real run on a normal machine.

## 10. Security and abuse resistance

- **Secrets.** Keys are read from `.env.local` only, never printed or logged, and never sent to the page. A tool
  such as `curl` reads the key inside the shell command so it does not appear in the transcript.
- **Same-origin and size caps** on every debug route; a missing `sec-fetch-site` header is allowed, since a token
  or limits still apply.
- **Prompt injection.** The candidate's text is data in a user message; system instructions say not to follow it.
  The assistant has no tools and cannot act, and the page applies a patch only on a click.
- **No server-side request forgery.** The gateway URL comes from the environment only. A user-supplied base URL is
  not accepted anywhere.
- **Rate limits and budgets** are the abuse controls (section 7); a stolen or forged round token is rejected by its
  signature.
- **Disclosure.** Chat text and code go to a third party, and free models may retain prompts after an opt-in on the
  gateway. The chat panel says so before a round starts.

## 11. Testing strategy

- **Unit tests (vitest, node environment)** for every pure library: line diff, unittest parser, event facts, store
  normalisers, reply parsing, round tokens, report building, concept map, random picker and slugs.
- **The scenario check** (section 2) runs real Python for every scenario.
- **Route tests** mock the limits module and the gateway (`fetch`) and cover: forged and expired tokens, the
  server-side cap, the hypothesis gate, the answer key never appearing in a prompt, the fixed token cap, truncation,
  budget and throttling, refunds, a gateway with no credit, and every fallback path of the report.
- **A storage test** uses a fake collection that throws error 11000, to cover the atomic reservation logic.
- **Browser passes** for anything visual or running in the browser's Python: the workbench, terminal, a runaway loop,
  drafts after a reload, the chat with faked server responses, the report, the random draw, and narrow-screen
  layout. UI responses were faked by wrapping `fetch` in the page.
- **Production build** after each structural change, because the build catches prerender-time mistakes the dev server
  does not.

## 12. Open technical decisions

- **[open] Bring your own API key: how it reaches the model.**
  - (a) Through our server to an **allowlist** of providers, with the key sent per request, never stored or logged.
    Works with every provider and keeps the fixed reply caps and the timeline. Recommended.
  - (b) Straight from the browser to the provider. The key never touches our server, but it needs provider CORS
    support and loses the reply caps, the timeline and the recorded facts.
  - (c) Both.
  - Either way, a user-typed base URL is out (server-side request forgery).
- **[open] User management model.** Likely a `users` document per account (plan, usage counters) created on sign-in,
  higher limits for signed-in users than guests, and a usage and account view. Export and delete of an account's data
  and an owner-only account list on the analytics page are candidates.
- **[planned] A plan field on each account** so the free limits in section 7 can be raised later for a paid tier
  (about ₹100 a month for unlimited use). The limits are constants today and would become a function of the plan.
  No billing or payment code is planned yet.
- **[open] Streaming replies** and a server-side sandbox for real concurrency or network scenarios.

---

## Changelog

- **2026-10-22:** Debug library grew from 35 to 42 cases: seven multi-bug cases (three failing tests each, found
  by reviewing how the AI-enabled rounds present failing codebases). All 42 were re-rated against the rubric in
  section 2: 16 easy, 21 medium, 5 hard.

- **2026-10-22:** Workbench title bar reorganised: back link and title on the left; timer, Assistant toggle and a
  more menu (reset, full screen, view report, theme) in the middle; Run (with run-all behind its arrow) and Submit
  on the right, Submit the most prominent. "Finish round" became Submit.
- **2026-10-22:** Submitting no longer waits in the dialog. `requestReview` (`src/lib/review-request.ts`) records a
  pending `review` on the chat, the page goes straight to the report, and `ReportSkeleton` mirrors the real report
  (real section titles, the six rating areas, a step list) until the report arrives or fails with a retry.

- **2026-10-22:** Docs refreshed after deploying `v2`: README rewritten for Rebase, decisions updated for the
  drawer sidebar, the case table, the hint-only assistant, the clean chat log and the prerender limit.
- **2026-10-22:** Opening a case now resets the assistant conversation (log and model history); the round budget
  and the review timeline are kept. Replaces the display-only filter.
- **2026-10-22:** Assistant answers only what was asked; greetings get a code-free prompt; the chat log starts clean
  each time the panel is opened.
- **2026-10-22:** Lesson prerendering limited to the first two weeks, cutting a build's server output from about
  234 MB to 87 MB.
- **2026-10-21:** The assistant became hint-only with four escalating levels; every patch and long code block is
  stripped on the server. "Ask for a patch" became "Check my hypothesis".
- **2026-10-21:** The sidebar became a right-side drawer on all screen sizes. The Debug case list became a table with
  custom dropdown filters, and "Ways to practice" was removed. The landing page gained a "How a debugging round
  goes" section.

- **2026-10-19:** Debug library grew from 26 to 35 cases modelled on reported interview bugs; all 35 now have an
  agent session, checked by a new test. Two symptoms rewritten as real reports. The home hero was cut to one
  question and one sentence, with the demo as a full-width workbench window.
- **2026-10-19:** Redesign. New look (Bricolage Grotesque, DM Sans, DM Mono; warm white and orange; pressable
  buttons). One app sidebar replaced the header tabs and second row. Learn's landing page was removed: Start the
  course goes to the course overview, and `/learn` is Today with a not-started state.
- **2026-10-19:** The platform home gained a continue block for returning visitors (`ContinueStrip`, reading the
  local plan and Debug progress), a row of counts read from the content, and a footer with every product's pages.
  `/learn` now opens with a course-specific pitch instead of repeating the home page.
- **2026-10-19:** The platform home moved to `/` and the Learn landing and Today dashboard to `/learn`. The header
  product dropdown became visible Learn and Debug tabs. The primary button is one colour across the app.
- **2026-10-19:** Rewrote this file to cover technical decisions only: structure, content pipeline, sandbox, editor,
  assistant, report, persistence, security and testing. Product naming, roadmap and working-practice notes were
  removed. Open decisions now list the bring-your-own-key transport options and the user-management model.
- **2026-10-19:** First version, from the whole conversation so far.
