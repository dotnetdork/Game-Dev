# Working on this repo

Read this before changing anything. It is the entry point the repo did not have: the rules were
always written down, but spread across a README, DEPLOY.md, two AUTHORING guides and forty file
headers, so every session re-derived them and some sessions got them wrong.

## What this is

A course app that teaches 11–14 year olds to build Phaser games. Students are on **school
Chromebooks behind filtered networks**, which is load-bearing and explains most of what follows. It
runs on **the League's own server**: one Docker container behind Caddy, deployed on every push to
`main` (see DEPLOY.md).

## Where things are

Everything that runs is under `app/`. The repository root holds documentation and tooling only.

| Path | What it is |
|---|---|
| `app/server.js` | Express: every route, the AI relay |
| `app/auth.js` `app/store.js` `app/telemetry.js` | sessions · per-student saves · event log |
| `app/ai/*.js` | the AI layer |
| `app/ai/agents/*.md` `app/ai/skills/*.md` | **prompts are content.** Editing these changes how the AI teaches |
| `app/content/` | the authored course. A person writes this — see `content/AUTHORING.md` |
| `app/public/js/` | the client: plain scripts, ordered in `index.html` |
| `app/tools/check-*.js` | **the test suite** (`npm test`), not utilities |
| `app/tools/build-*.js` | generators |
| `app/public/phaser-docs/` | **generated**, 989 files. Never hand-edit; `npm run build:docs` |
| `app/public/vendor/` | vendored libraries. Never hand-edit |
| `app/public/assets/` | CC0 art, committed |

## Constraints that are decisions, not oversights

1. **No bundler, no build step for client code.** `app/public/js/*.js` are plain scripts sharing
   globals, loaded in a deliberate order in `app/public/index.html` where the comments explain the
   dependencies. A new client file is a new `<script>` tag with an ordering comment. **Never convert
   to ES modules** — the simplicity is why this loads on a filtered school network at all.
2. **Four runtime dependencies** (`express`, `dotenv`, `zod`, `@modelcontextprotocol/sdk`), and that
   is a ceiling. `store.js` speaks to Redis over plain `fetch` rather than take a client library.
   Adding a dependency needs asking first.
3. **Express 4, not 5.** `package.json` pins a `qs` override and says why. Upgrading is a breaking
   change to a working server.
4. **Long explanatory comments are the house style.** Many files open with 20–40 lines explaining
   why the code is shaped as it is, usually citing the bug that caused it. That is documentation for
   a solo maintainer and for you. Do not strip it and do not call it bloat.
5. **`app/tools/check-*.js` repeat themselves on purpose.** Each is a standalone script a human runs
   and reads. Seven copies of a five-line `check()` helper is the price of that, and it is worth it.
6. **One long-lived server, not serverless.** The app is a single Node process in Docker on the
   League server (`docker-compose.yml`, `.github/workflows/deploy.yml`). It has a writable disk
   (student saves go to the `gamedev_state` volume at `app/.data`), no platform timeout, and can do
   background work. **Vercel is not a constraint.** The first beta test ran on Vercel serverless
   and it will very likely never be used again, but many file headers explain decisions made under
   its limits (60s ceiling, no disk, cold starts). Read those as history. What still holds:
   per-request state goes on the request, never in a module `let`, because two students' requests
   interleave in the one process.

## Two rules that come from real mistakes

**One fact, one place.** If a decision is explained in a file header, link to it
(`see game-runner.js:3`) rather than restating it. Three files once gave three different accounts of
whether the game frame is sandboxed; at least two were wrong, and nobody could tell which.

**Verify before claiming.** A subagent's report — a security hole, a missing check, dead code — is a
lead, not a finding, until you have read the lines yourself. `/api/usage` was reported as
unauthenticated and "fixed"; `app.use(auth.requireAuth)` had covered it the whole time, and the
commit message now describes a hole that never existed.

## Before you commit

- `npm --prefix app test` — 17 checks including `check-boot.js`, which starts the real server and
  drives the real page.
- `npm --prefix app run check:release` before anything goes in front of a class.
- Read `process.env.X` in code? Add `X` to `app/.env.example` in the same commit. `check-env.js`
  enforces this.
- Client-side change that is visible? Look at it in a browser. `check-boot.js` runs under jsdom,
  which has no layout and does not execute iframes — it cannot see a broken game frame or a
  collapsed panel.

## Ask first

- Adding a dependency, or changing the client script order.
- Touching the cookie or signing code in `app/auth.js`.
- Anything in `app/content/lessons/` — a person authored it.
- Deleting a file. Move it or empty it in a commit that says why.
