# Rebase

Practice for AI-enabled engineering interviews, and a free 16-week course on how computers work, taught in Python. Rebase is one Next.js app with two products:

- **Learn.** A 64-day course: each day has a short lesson, curated links, a small build, an engineering step and a check, plus revision cards, linked notes and a schedule that adapts when you fall behind.
- **Debug.** 42 broken programs with failing tests (16 easy, 21 medium, 5 hard). Seven of them break in three separate ways at once, so several tests fail for different reasons, as in a real round. Fix them in an in-browser editor that runs Python, or read an agent's session and decide whether you would approve its patch. An assistant gives hints (never the fix), and a mentor report reviews how you worked at the end.

Progress, revision cards and notes live in your browser first, and sync to your account if you sign in.

[![Rebase promo preview](docs/promo.gif)](video/renders/video.mp4)

_Click the preview to open the full 26-second promo ([video/renders/video.mp4](video/renders/video.mp4))._

## Debug

- **Cases** is a table you can search and filter by topic, difficulty and status, with solved progress for Easy, Medium and Hard.
- **Workbench:** a CodeMirror editor, a test runner (the failing test and a hidden regression suite), a terminal and a diff of your changes. Python runs in the browser, so nothing you write runs on the server.
- **Review mode:** read what an agent did, run its patch against both suites, then approve or request changes. The answer is revealed afterwards.
- **Assistant:** a limited chat (12 messages and 45 minutes a round). It answers only what you ask, uses only that case's code and test output, and gets slightly more specific each time you ask for help, but never writes the fix. Greetings get a short reply with no code. Each time you open a case the conversation starts fresh, for you and for the assistant (the hint level resets too). The message budget of the round and the timeline used for the review are kept.
- **Mentor report:** after you finish a round, a reviewer reads the chat, the timeline and what you changed and writes feedback.
- **Random draw:** a case with its title and topic hidden until you finish.

## Run it locally

You need Node.js 20 or later.

```bash
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run dev                  # http://localhost:3000
```

The course content works without any configuration. Signing in, sync and the Debug assistant need the environment variables below.

| Variable                               | Used for                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `MONGODB_URI`, `MONGODB_DB`            | Synced progress and notes, assistant limits and analytics (MongoDB Atlas)            |
| `AUTH_SECRET`                          | Auth.js session signing and the assistant's round token (`openssl rand -base64 33`)  |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign-in. The redirect URI is `<site>/api/auth/callback/google`                |
| `AUTH_URL`                             | Only when not hosting on Vercel: the public URL                                      |
| `ANALYTICS_OWNER_EMAIL`                | Google email(s) allowed to open `/analytics` (comma-separated)                       |
| `TOKEN_API_KEY`                        | The assistant's model gateway (Token Harbor, OpenAI-compatible)                      |
| `TOKEN_BASE_URL`, `TOKEN_MODEL`        | Optional. Default `https://tokenharbor.ai/v1` and `deepseek-v4.1-flash:free`         |
| `TOKEN_REVIEW_MODEL`                   | Optional. The model for the mentor report                                            |
| `DEBUG_DAILY_TOKEN_BUDGET`             | Optional. Tokens the assistant may use per UTC day, across everyone (default 400000) |

Of the `TOKEN_*` variables only `TOKEN_API_KEY` is needed; the rest have defaults. `AUTH_SECRET` and `TOKEN_API_KEY` must both be set for the assistant. Without them the chat says "Agent chat is not configured." On a host such as Vercel, set the variables for the right environment and redeploy, since changes only apply to new deployments.

If `mongodb+srv://` fails locally with `querySrv EREFUSED`, your network's DNS is refusing SRV lookups. Switch to a public DNS server (8.8.8.8 or 1.1.1.1), or use Atlas's standard `mongodb://` connection string. The assistant needs MongoDB for its message limits, so it shows "temporarily unavailable" while this is broken.

## Deploying

The app deploys to Vercel from `main`. Only the first two weeks of lesson pages are prerendered (`PRERENDER_WEEKS` in `src/lib/day-steps.ts`); later days render on first visit and are cached. This keeps a build's output near 90 MB instead of about 230 MB, which matters because Vercel keeps every deployment. Set a short Deployment Retention in the project settings too.

## Analytics

`/analytics` is a private dashboard for the site owner: page views, unique and returning visitors, sessions, top pages, referrers, countries, devices, and a list of who visited (the name and email of signed-in visitors, a short id for everyone else). Anyone who is not signed in as `ANALYTICS_OWNER_EMAIL` gets a 404.

- Views are sent from the browser to `/api/track` and stored in a `visits` collection in the same MongoDB database, then expire after about 13 months. No third party is involved.
- Recorded per view: path, referrer host (first page of a session), country and city from Vercel's IP headers, browser, OS, device type, and the account when signed in. IP addresses and query strings are not stored.
- Skipped: bots, Do Not Track and Global Privacy Control, the owner's own signed-in visits (stored but hidden), and `next dev` (set `ANALYTICS_TRACK_DEV=1` to include it).

## Scripts

| Command              | Does                                                      |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | start the dev server                                      |
| `npm run build`      | production build                                          |
| `npm run lint`       | ESLint                                                    |
| `npm run typecheck`  | TypeScript check                                          |
| `npm test`           | Vitest                                                    |
| `npm run data:build` | regenerate `src/data/curriculum.json` from `data/legacy/` |

## Where things live

- `data/notes/<day>.md`: the lesson text for each day (`w3d2` is week 3, day 2; `f2d1` is foundations week 2, day 1). Sections start with `@@ learn`, `@@ build`, `@@ dsa`, `@@ engineering` and `@@ check`.
- `data/legacy/*.js`: the plan's structure, links and exercises. After editing, run `npm run data:build`.
- `data/debug/`: the Debug cases. The answer key never leaves the server.
- `src/data/revision/`: revision questions and cards.
- `src/app/(learn)`, `(debug)`, `(workbench)`, `(account)`, `(platform)`: one route group per area, so each brings its own shell.
- `src/lib/debug-agent.ts`: the assistant's prompt and hint ladder. `src/lib/agent-reply.ts` strips fixes from replies.
- `decisions.md`: why things are the way they are, with a changelog. Update it when a decision changes.

## Built with

Next.js 16 (App Router, Cache Components) and React, Auth.js, MongoDB, CodeMirror 6, Pyodide for in-browser Python, and Vitest. Notes, progress and review state are stored in `localStorage` first and synced per user.
