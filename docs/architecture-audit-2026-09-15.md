# Architecture audit — 15 September 2026

Measured against `main` at `4b634b5`. Every path and line number below was read, not inferred;
where I could not verify something it says so. Companion to `audit-2026-09.md` (content and UX);
this one is structure, state, duplication and the plan to fix them without stopping the beta.

---

## 1. Verdict

The codebase is in better shape than the "AI wrote it" framing predicts, and worse than its own
comments believe.

**Better:** the small modules are genuinely good. `store.js`, `auth.js`, `events.js`, `loader.js`,
`sync.js` each own one thing, explain their decisions, and were plainly written by somebody who had
been bitten and wanted the next person not to be. The security reasoning — signed cookies over a
session store, identity from the session and never the body, the tester door's honest scope, the CSP
note that refuses to lie about `unsafe-inline` — is above the standard of most hand-written apps this
size. There is a real test suite that boots the real server. There is no `eval` anywhere in the
parent page. The vendor-nothing / four-dependency discipline has held for 193 commits.

**Worse:** the discipline that held at the module boundary collapsed inside the three big files.
`server.js` (1302), `widgets.js` (2411) and `board.js` (2339) are 6,000 lines that were touched
34, 37 and 9 times in six weeks — and they grew the way Eric described: by addition, never by
extraction. The result is not one duplication but a *pattern* of duplication: two prompt assemblers,
two sandboxed-document builders, two console panels, two "what is my origin" functions, two rules
for when a cookie is `Secure`, four copies of the same guard-retry-recheck block, seven identical
catch blocks. In each case the second copy carries a comment noting that the first exists.

**The trajectory is the one Eric warned about, and it has a specific tell:** the in-file
documentation, which is this project's real strength, has started to contradict itself. Three files
now give three different accounts of whether the game frame is sandboxed. A subagent told me this
morning that two endpoints were unauthenticated; they were not, and I shipped a redundant "fix" with
a wrong commit message on its word. The comments are load-bearing here, and when the same fact lives
in three of them, one of them is wrong.

None of this needs a rewrite. All of it needs extraction along seams that are already visible in the
line numbers, plus one short file that tells the next AI session what the rules are before it starts.

---

## 2. Findings, by severity

### S1 — resolve before Sunday 20 September

**F1. Nobody knows whether the student's game runs sandboxed. Three files disagree, and no test can
tell.**
- `app/public/js/game-runner.js:3-17` — header says the sandbox is *"confirmed working in Chrome"*,
  and that only the dev preview pane fails; `sandboxGame()` returns `DEV.sandboxGame`.
- `app/public/js/dev.js:59-80` — says `sandboxGame: true` is *"KNOWN BROKEN … Phaser is not
  defined"* with measured results, and that *"`?sandbox=0` is how you run a game today."*
- `app/server.js:172-176` — CSP comment says the origin is named explicitly *"while the sandbox is
  still off."*
- `app/public/js/game-runner.js:312` applies `sandbox="allow-scripts"` when `DEV.sandboxGame` is
  true, which it is by default.

  Why it is S1: the frame runs code written partly by a model and partly by whatever a child pasted.
  `game-runner.js:4-6` records a probe showing that *without* the sandbox that code *"could write
  the parent's localStorage, read document.cookie, and call parent.completeLesson() directly"* — and
  now also POST to `/api/ai` with the child's session. Either the sandbox works and `dev.js` is
  stale, or it does not and every game on Sunday is same-origin. `check-boot.js` runs under jsdom,
  which does not execute iframes, so the suite cannot answer this.

  **Do:** on the deployed URL in real Chrome, open a lesson, press Play, and confirm the game
  renders. Then in DevTools: `document.getElementById('gameFrame').getAttribute('sandbox')` should
  read `allow-scripts`. Whichever way it comes out, delete the two stale comments the same day.

**F2. The leaderboard shows children fabricated classmates.**
- `app/public/js/pages.js:361-372` — `sampleBoard` is a hard-coded list (*Ava R., Leo M., Ivy L.,
  Mia T., Eli J., Sam K.*) rendered as peers with XP, levels and a podium (`renderBoard`,
  `pages.js:387-440`). A real student is inserted among them at their true rank.
  Jay has already named this ("truncate the leaderboard"). In a product for 11-year-olds, invented
  social comparison is not a placeholder; it is a claim. Empty the array or gate the page behind
  `data-dev-only` until there is real data.

**F3. A `while` loop with a wrong condition freezes the whole tab, and the lesson that teaches
`while` is in the course.**
- Open since `docs/audit-2026-09.md` §0 ("An infinite loop has no handling anywhere"). Confirmed
  still true: no watchdog, iteration cap or worker isolation in `gameDoc()`
  (`game-runner.js:240-300`) or `labDoc()` (`widgets.js:1091-1146`). A `srcdoc` iframe shares the
  parent's event loop; the console, the error panel and the AI are all in the frozen tab.
  Not fixable by Sunday without risk. **Mitigation for Sunday:** the instructor knows that
  "Page unresponsive" means close the tab and reopen — work is in localStorage and (after Step 0 in
  the session-logging plan) on the server. **Real fix (post-beta):** an instrumented loop guard
  injected the same way `errorReporterScript()` is, or the long-planned separate-origin frame.

**F4. A per-request deadline is stored in a module-level variable.** *(Introduced by me this
morning.)*
- `app/server.js:883` `let aiDeadline = 0;` set at `:1018` inside `POST /api/ai`, read by
  `callSignal()` (`:890`). Two concurrent requests on one warm instance overwrite each other's
  deadline; the earlier one inherits the later one's budget. On Vercel a single instance does serve
  concurrent requests.
  **Fix:** pass the deadline down — attach it to `spec` in `resolveModel()`'s return or add a
  parameter to `chatOnce`/`callAI`. Ten lines, no behaviour change for the single-request case.

**F5. `/api/usage` was never unauthenticated, and today's commit says it was.**
- `app/server.js:249` `app.use(auth.requireAuth)` is global and precedes every `/api/*` route;
  `requireAuth` (`auth.js:604`) 401s any `/api/` path without a session, and `enabled()` is
  hard-coded `true` (`auth.js:295`). A subagent reported the endpoints as open; I did not verify and
  added a second check at `server.js:510-517` with a commit message claiming a hole. The check is
  harmless; the commit message is wrong, and the process failure is precisely the one this audit is
  about.
  **Fix:** keep or drop the redundant check, but correct the comment above it so the next reader is
  not told there was a hole. Record the lesson in the guardrails file (§4): *verify a subagent's
  security claim by reading the middleware order before acting on it.*

### S2 — structural debt that makes every change slower

**F6. `server.js` is five modules in one file.** The seams are already clean line ranges:

| Lines | What it is | Should be |
|---|---|---|
| 53-136 | provider/model config, `resolveModel` | `app/ai/models.js` |
| 149-154 | rate limit | stays (5 lines) |
| 156-247 | CSP, hosted-cookie, middleware | `app/middleware.js` |
| 278-425 | content index, credits, mtime cache — **including a mid-file `require('fs')` at 279 and `require('./public/vendor/js-yaml/js-yaml.min.js')` at 278**, the browser bundle loaded server-side | `app/content-index.js` |
| 449-541 | `/api/state`, `/api/events`, `/api/usage` | `app/routes/state.js` (or stay) |
| 544-860 | JSON extraction, history sanitising, `buildContextBlock`, the four validators, fallback prompts | `app/ai/guards.js` + `app/ai/fallback.js` |
| 866-1005 | timeouts, `chatOnce`, `toolResultMessage`, `callAI` | `app/ai/provider.js` |
| 1006-1337 | the `/api/ai` handler | `app/routes/ai.js` |

  Nothing in that table needs to change behaviour to move. Each block reads only module constants
  and the modules above it.

**F7. There are two prompt assemblers, and one of them is 110 lines of insurance that has never been
tested.**
- `app/ai/loader.js` builds prompts from `ai/agents/*.md` + `ai/skills/*.md` with `{{slots}}`
  (`buildPrompt`, `:136-192`; renderers `:79-121`).
- `app/server.js:582-636` `buildContextBlock` and `:820-860` `fallbackCoderSystem` /
  `fallbackTutorSystem` / `FALLBACK_AGENT_SYSTEMS` re-implement the same context rendering as string
  literals — asset lists, file lists, practice task, guided-mode rules — used *only* if a Markdown
  file is missing or malformed (`server.js:818-819`).
  The two have already diverged: the fallback has no lab, board, grader or explain-a-line slots;
  `loader.js:176-180` documents that a missing slot is silently `''` and that this hid a bug.
  A fallback that produces a materially different prompt is not a fallback; it is a second product
  with no tests. **Decision required (see Phase 3):** either delete the fallbacks and let a missing
  agent file 500 loudly (the `.md` files are in the repo and `check-mcp.js` already loads them), or
  move them to `app/ai/fallback.js` with a check that asserts each renders every slot `loader.js`
  does.

**F8. The `/api/ai` handler repeats itself four times over, then seven more.**
- Guards at `server.js:1167-1236`: four blocks with identical shape — detect → build an
  `IMPORTANT:` retry string → `callAI` → `extractJSON` → `toOps` → re-detect → give up with a
  kid-facing sentence. Only the detector, the retry text and the give-up sentence differ. That is a
  table of four entries and one loop.
- Seven textually identical `catch (e) { return res.status(502).json({ reply: 'The AI service is not
  reachable right now (' + e.message + ').' }); }` (`:1106`, `:1122`, `:1132`, `:1162`, `:1176`,
  `:1191`, `:1209`, `:1230`).
- Five agent branches each assemble their own response shape (`:1099-1150`).
  Eighteen exits is why the telemetry had to wrap `res.json` instead of instrumenting the code.

**F9. `widgets.js` contains a 700-line lab bench that has its own name for everything.**
- `widgets.js:1063-1770`: **31 functions prefixed `lab`** (`labDoc`, `labConsoleLine`, `openLab`,
  `closeLab`, `labRun`, `labPause`, `labTutorAsk`, …), their own state (`labLog`, `labConsoleShut`,
  `openLabRef`, `labPendingAdvance`), their own iframe protocol (`__cm`, `__labctl`), their own
  console, their own tutor chat (`labTutorSay` / `labTutorAsk` `:1639-1704`, a second chat UI
  alongside `ai.js`). It is a module that was never given a file.
- The same file also holds the quiz system (`:581-1006`, four `build*` functions through one
  `quizVerdict` chokepoint), run cells and demos (`:181-560`), prose post-processing
  (`:2104-2250`), and the lesson lifecycle (`:2257-2560`).

**F10. Two sandboxed-document builders and two console panels, each acknowledging the other.**
- `game-runner.js:240-300` `gameDoc()` and `widgets.js:1091-1146` `labDoc()` each build a `srcdoc`
  with: a console-capture shim (`capture` at `:249` vs `labConsoleShim` at `:1063`), an rAF pause
  shim (`__gamectl` at `:151`/`:254` vs `__labctl` at `:1139-1144`), a `window.onerror` forwarder,
  and a parent-message protocol (`__gamelog` vs `__cm`). `game-runner.js:253` says *"Same shim the
  lab uses — see labDoc()"*. This morning I widened `onerror` in one and not the other.
- `console-dock.js:30` `conLine` / `gameLog` / `GAMELOG_MAX=60` and `widgets.js:1178`
  `labConsoleLine` / `labLog` / `LAB_LOG_MAX=80`. `widgets.js:1148` says *"Same markup, classes and
  behaviour as the game console."* They have already drifted: one counts repeats by rewriting
  `textContent`, the other by a counter; one caps at 60, the other 80.

**F11. `project.js` is four unrelated concerns behind one filename.**
- `:3` the `$` helper every other file uses; `:10` `mdToSafeHTML` (the app's XSS boundary, which
  calls `esc()` from `pages.js` — a file loaded 13 script tags later; works at runtime, but the
  sanitiser depends on a page-rendering file); `:15` `studentId` minting; `:25-220` schema and
  migrations; `:256-445` `validJS`, `applyOps`, `opsToChanges` (the AI-edit applier); `:447-830`
  progress, XP, badges, streaks, the footer. The header comment lists them all, which is the tell.

**F12. Cross-file global state without an owner.**
- `course.js:345-352` declares `currentAIMode`, `aiMode`, `aiModels`, `currentLessonText`,
  `currentPracticeTask` — all consumed by `ai.js`, which is loaded ten scripts later and owns the
  panel they describe. `paintAIModeAvailability` (`course.js:356-371`) silently changes the agent
  (`setAIMode('tutor')`) as a side effect of a tab change; the server had to be told to log the
  agent it actually ran rather than the one the UI showed (`server.js:1066-1070`).
- `chats` in `ai.js:7` is documented as *"a VIEW onto the current thread's messages"* — an aliasing
  trick so call sites did not have to change. Deliberate, but it means two names for one array.

**F13. Two implementations of "what is my origin", two rules for "is this cookie Secure".**
- `auth.js:416-421` `origin(req)` honours `PUBLIC_ORIGIN`, `x-forwarded-proto` and
  `x-forwarded-host`. `server.js:178` `cspFor` rebuilds it from `x-forwarded-proto` and raw `host`,
  with no `PUBLIC_ORIGIN` — so a deployment that needed the override for OAuth gets a different
  origin in its CSP.
- `auth.js:394` marks cookies `Secure` when `NODE_ENV=production || VERCEL`; `server.js:243` (mine)
  marks `league_hosted` `Secure` when `req.secure || x-forwarded-proto === 'https'`. Two different
  answers to the same question, and I wrote the second one without finding the first.

### S3 — dead code, drift, hygiene

**F14.** `app/ai/usage.js:41-45` — `listeners`, `onRecord`, `emit` for a `/api/usage/stream`
endpoint that does not exist; `emit()` is never called and `onRecord` is not exported (`:113`).
`:18-19` `fs` and `path` are required and unused. `:37` all state is module memory — on serverless
the numbers at `/api/usage` describe one instance's lifetime, not the session, which the header
comment (`:14-16`) still calls deliberate. `record()` now also has a `telemetry.record` sibling that
does survive; route the former through the latter and delete the bus.

**F15.** `studentId` — minted at `project.js:15-16`, sent on every AI request (`ai.js` ×5,
`widgets.js` ×1), ignored by the server since `server.js:141-144` explained why. Eight lines of wire
carrying nothing.

**F16.** `auth.js:295` `function enabled() { return true; }` guards `requireAuth` (`:582`) and
appears in the boot banner (`server.js:1374`); `auth.js:573` reports `local: !!u.local`, a field
nothing sets.

**F17.** Environment variables read in code and absent from `app/.env.example`: `AI_CALL_TIMEOUT_MS`,
`AI_TOTAL_BUDGET_MS` (both mine, today), `DEMO_LOGIN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `STATE_DIR`, `TESTER_PASSWORD`. Some are
covered by `DEPLOY.md`; none is discoverable from the file people are told to copy.

**F18.** `app/tools/strip-manifest-uris.js` is referenced by nothing. `app/tools/legacy-assets.json`
(72 KB) is read only by `import-kenney.js`, a one-off importer whose output is committed.

**F19.** `app/content/_archive-v1/` (54 files) sits under the statically served `/content` mount
(`server.js:263`) and inside the tree `newestMtime()` walks for cache invalidation. Dead course
material, reachable by URL, scanned on every index rebuild.

**F20.** `.claude/worktrees/keen-yonath-df7483/` — 499 files, 10.7 MB, a detached-HEAD worktree of
the pre-rename repo. `git worktree list` marks it `prunable`. It is why any recursive listing of
`.claude/` is unreadable. `git worktree prune` and delete the directory.

**F21.** `app/ai/loader.js:122-127` `fill()` turns an unknown `{{placeholder}}` into `''` silently.
`:176-180` records that this hid the grader receiving no context at all. A prompt author typo
(`{{lessonTitel}}`) produces a quietly worse agent, not an error. Warn once per unknown slot, the
way `warn()` already does for missing files.

**F22.** `store.js:71-74` hashes identities in `state:` keys so no child's email appears in a Redis
dashboard; `bump()` at `:152` writes `gd:v1:rl:ai:<email>` in the clear. The privacy rule in the
file's own header (`:37-39`) is applied to one of the two key families.

**F23.** `.github/workflows/test.yml:17` installs with `npm ci || npm install`, which hides a stale
lockfile instead of failing on it. CI runs Node 20, Vercel 24, the development machine 26;
`engines` says `>=18`. Nothing tests on the version that serves children.

**F24.** Known and documented, becomes real only after the store is attached: the rate limiter
(`server.js:150-154`, `store.js:137-139`) counts in memory and fails open. Not a defect in the code;
a defect in the deployment, tracked in the session-logging plan as Step 0.

**Not found, for the record:** no `eval`/`new Function` in the parent page (`project.js:236` notes
the one there was and why it went); no unawaited promise of consequence server-side (every
`store`/`fetch` call is awaited; `telemetry.record` is synchronous by design); `trust proxy` is set
(`server.js:46`), so `req.ip` behind Vercel is the client. `npm audit` is clean including
devDependencies as of this morning.

---

## 3. Phased plan for Claude Opus

Every phase leaves the app shippable and `npm test` green. Phases marked **[pre-beta]** are safe
before Sunday; nothing else is to be attempted before the 20th. Order within the post-beta phases
is by how much later pain each removes, not by size.

### Phase 0 — [pre-beta] correctness, no structure moved  *(~2 hours)*

- [ ] **F1** Verify the sandbox on the deployed URL as described. Then delete whichever of
      `dev.js:59-80` or `game-runner.js:3-17` is wrong, and fix `server.js:172-176` to match.
- [ ] **F2** `pages.js:361` → `const sampleBoard = [];` and make `renderBoard` render the empty
      state honestly ("Nobody on the board yet"). Or add `data-dev-only` to the Leaderboards nav
      button (`index.html`) and extend `check-release.js` to assert it.
- [ ] **F4** Thread the deadline: `resolveModel()` returns `{provider, model, agent}`; have
      `POST /api/ai` build `spec = Object.assign({}, resolveModel(agent), { deadline: t0 +
      TOTAL_BUDGET_MS })` and have `budgetLeft(spec)` / `callSignal(spec)` read it. Delete
      `let aiDeadline`. `chatOnce` already receives `spec`.
- [ ] **F5** Rewrite the comment at `server.js:506-509` to say the check is belt-and-braces over
      the global `requireAuth` at `:249`, not a fix for a hole.
- [ ] **F17** Add the nine variables to `.env.example`, each commented, defaults shown.
- [ ] **F20** `git worktree prune`; remove `.claude/worktrees/`.
- [ ] Write `CLAUDE.md` (§4).
- **Verify:** `npm test`, `npm run check:release`, and a full pass through one lesson on the
  deployed URL including Play.

### Phase 1 — split `server.js` along its existing seams  *(~1 day)*

Pure moves. No function body changes. One commit per extraction so each is bisectable.

- [ ] Create `app/ai/models.js` from `server.js:53-136` (provider constants, `AGENT_MODELS`,
      `resolveModel`, `agentTool`, `AGENT_TOOLS`). Export what `server.js` uses.
- [ ] Create `app/middleware.js` from `:156-247` (`cspFor`, the hosted-cookie middleware). While
      there, make `cspFor` call `auth.origin(req)` — **the one behaviour change in this phase**,
      fixing F13's origin half; note it in the commit.
- [ ] Create `app/content-index.js` from `:278-425` (`newestMtime`, `frontMatter`, `rewardOf`,
      `buildIndex`, `plainText`, `buildCredits`, both caches). Move the two mid-file `require`s to
      its top. Have it `require('js-yaml')`… no — keep the vendored copy (constraint 2), but require
      it once at the top of the new file with a comment.
- [ ] Create `app/ai/provider.js` from `:866-1005` (timeouts, `chatOnce`, `toolResultMessage`,
      `callAI`).
- [ ] Create `app/ai/guards.js` from `:544-811` (`extractJSON`, `unwrapDoubleJSON`,
      `sanitizeHistory`, the asset/API/key validators, `claimsChangeWithoutOps`). Leave
      `buildContextBlock` and the fallbacks in place for Phase 3.
- [ ] Create `app/routes/ai.js` exporting `function mount(app, deps)` containing the `/api/ai`
      handler from `:1006-1337`, in the same injection style as `auth.mount(app, {limit})`.
- [ ] `server.js` becomes: requires, `app` setup, middleware, static, `mount`s, boot. Target
      **< 250 lines**.
- **Verify:** `npm test` (in particular `check-boot.js`, which drives the real server), plus
  `curl` of `/api/info`, `/api/lessons`, `/api/credits` before and after, diffed. Add to
  `check-boot.js`: a POST to `/api/ai` with `AI_PROVIDER=ollama` and no Ollama running must return
  502 with the "not reachable" body — proving the route is mounted and its error path intact.

### Phase 2 — collapse the guard chain and the exits  *(~half a day)*

In `app/routes/ai.js` (now small enough to see):

- [ ] Replace the four guard blocks with a table:
  ```js
  const GUARDS = [
    { name: 'no-ops',    detect: (parsed, ops) => claimsChangeWithoutOps(parsed.reply, ops), retry: () => '…', giveUp: '…' },
    { name: 'bad-api',   detect: (parsed, ops) => badApisIn(ops, gameCode, ctx.files),      retry: (hits) => '…', giveUp: '…' },
    { name: 'bad-key',   … },
    { name: 'bad-asset', when: () => ctx.hasAssetList, detect: …, retry: …, giveUp: (bad) => assetApology(bad, ctx.assets) }
  ];
  for (const g of GUARDS) { /* detect → guard(name) → retry once → re-detect → guard(name, true) + give up */ }
  ```
  The `guard()` telemetry call moves inside the loop and is written once. Preserve the two
  asymmetries the current code has (`allCode` vs `gameCode` on the asset re-check; sequential
  mutation of `ops`) **or** fix them deliberately and say so — do not fix them by accident.
- [ ] One `unreachable(e)` helper for the seven identical 502 responses.
- [ ] One `respond(agent, raw)` that owns the five response shapes.
- **Verify:** `check-quiz.js` and `check-grade.js` already cover the JSON agents. Add
  `app/tools/check-guards.js`: feed each guard a crafted `ops` and assert it fires, and feed it a
  clean one and assert it does not. Deterministic, no model needed — the detectors are pure.

### Phase 3 — one prompt assembler  *(~half a day, one decision)*

- [ ] **Decide:** delete the fallbacks, or keep them under test. My recommendation is **delete**.
      The `.md` files are committed, `loader.js` warns once and returns `null`, and a 500 with
      `"The coder prompt is missing (ai/agents/coder.md)"` — which the tutor branch already does at
      `server.js:1103` — is the honest failure. A silent switch to a 110-line string literal that
      lacks half the slots is not a graceful degradation.
- [ ] If deleting: remove `buildContextBlock`, `GUIDED_RULES`, `fallbackCoderSystem`,
      `fallbackTutorSystem`, `FALLBACK_AGENT_SYSTEMS` (`server.js:582-636`, `:812-860`) and the
      `||` fallbacks at the five `buildPrompt` call sites.
- [ ] Either way: `loader.js:fill()` warns once per unknown placeholder (F21).
- [ ] Add `app/tools/check-prompts.js`: `buildPrompt(agent, fullCtx)` for all six agents renders
      with **zero** unfilled `{{…}}` and includes a sentinel from every slot the agent's `.md`
      declares. This is the test that would have caught the grader receiving nothing.

### Phase 4 — give the lab bench its own file  *(~1 day)*

- [ ] Create `app/public/js/lab.js`; move `widgets.js:1063-1770` (the 31 `lab*` functions,
      `openLab`/`closeLab`, `LAB_W/H/SCALE`, `labLog`, `labConsoleShut`, `openLabRef`,
      `labPendingAdvance`) into it verbatim. Add the `<script>` after `widgets.js` in `index.html`
      with the ordering comment the file's neighbours have. Nothing in `lab.js` is called at load,
      so order after `widgets.js` is safe; `widgets.js` calls `openLab` at click time.
- [ ] Then `app/public/js/quiz.js` from `widgets.js:581-1006` (`renderQuizCells`, `quizVerdict`,
      `markQuizDone`, the four `build*`, `quizPrompt`, `blockHeader` family if only quizzes use it —
      check).
- [ ] `widgets.js` target: **< 1,000 lines** — lesson lifecycle, run cells, prose post-processing.
- **Verify:** `check-challenges.js` (labs are solvable) and `check-lessons.js` (quizzes parse) are
  the existing net; `check-boot.js` asserts the page boots with no uncaught errors, which is what
  catches a load-order mistake. Manually: open a lab, run it, pause, fail it, get the hint; answer
  one of each quiz type wrong then right.

### Phase 5 — one sandbox document, one console  *(~1 day)*

- [ ] `app/public/js/sandbox-doc.js`: a single `sandboxDocument({ token, protocol, body, pause,
      capture })` that both `gameDoc()` and `labDoc()` call. One console shim, one pause shim, one
      `onerror` forwarder carrying `file`/`line`/`col`, one `unhandledrejection` handler. The
      protocols (`__gamelog`/`__gamectl` vs `__cm`/`__labctl`) become parameters, not copies. This is
      also where the loop guard (F3) goes, once, later.
- [ ] `app/public/js/console-panel.js`: `makeConsole({ bodyId, max, onLine })` returning
      `{ line, clear, recent }`; `console-dock.js` and `lab.js` each instantiate one. Resolve the
      60-vs-80 cap and the two repeat-counting styles deliberately.
- **Verify:** `check-gamelog.js` already loads `console-dock.js` into a fake DOM (`loadDock()`);
  extend it to instantiate the shared panel and assert both behaviours. Manual: game error shows in
  the dock with a line number; lab error shows in the bench.

### Phase 6 — split `project.js`  *(~half a day)*

- [ ] `app/public/js/dom.js` — `$` and `esc` (moved from `pages.js:490`), loaded **first** among
      app scripts, so the sanitiser no longer depends on the page renderer.
- [ ] `app/public/js/ops.js` — `validJS`, `parseConfig`, `insertIntoFn`, `lineDiff`, `applyOps`,
      `opsToChanges`, `keepsTopLevelFunctions` (`project.js:256-445`).
- [ ] `app/public/js/progress.js` — `DEFAULT_STATE`, `loadState`, activities, labs, practice,
      badges, XP, streaks, `saveState`, `renderFooter` (`:447-830`).
- [ ] `project.js` keeps: schema/migrations, `defaultProject`, `loadProject`, `saveProject`, file
      helpers.
- [ ] Delete the `studentId` wire (F15): `project.js:15-16`, the six send sites.
- **Verify:** `check-state.js` (migrations, never-destroy-a-save) is the net and must not change.

### Phase 7 — the leftovers  *(~half a day)*

- [ ] `usage.record` → also `telemetry.record('model', …)`; delete the listener bus and the unused
      requires (F14); reword the header.
- [ ] `auth.js`: remove `enabled()` and its three call sites, remove `local` (F16).
- [ ] One `secureCookie(req)` rule used by `auth.setCookie` and the hosted-cookie middleware (F13).
- [ ] Hash the `rl:` key the way `state:` is hashed (F22) — note it resets in-flight counters once.
- [ ] Delete `tools/strip-manifest-uris.js`; move `legacy-assets.json` next to `import-kenney.js`'s
      documentation or delete it if the import is never re-run (F18).
- [ ] Move `content/_archive-v1` out of `app/content` to `docs/archive/` or delete (F19).
- [ ] CI: `npm ci` only; add a Node 24 matrix entry (F23).

**Not scheduled:** `board.js`. See §5.

---

## 4. Tooling recommendation

**Warranted, narrowly. Two things.**

The project's in-file documentation is unusually good and is doing most of what a guardrails file
would do. But it has no *entry point*: there is no `CLAUDE.md`, so every session — including mine
today — re-derives the rules from README, DEPLOY.md, two AUTHORING guides and forty file headers,
and gets some of them wrong. The concrete drift I can point to from one day:

1. Three files disagreeing about the sandbox (F1) — the same fact, maintained in three places.
2. My redundant auth fix on a subagent's unverified claim (F5).
3. My second cookie-`Secure` rule beside an existing one (F13).
4. `vercel link` appending `.env*` to `.gitignore`, shadowing a tracked file, caught only by reading
   the diff.
5. Nine undocumented environment variables, two of them mine (F17).

Each is a session not knowing a rule the repo already had.

**Tool 1 — `CLAUDE.md` at the repository root, under 80 lines.** Not a style guide. Specifically:

- The map: everything is under `app/`; `api/index.js` is a shim; `tools/check-*.js` is the test
  suite; `public/phaser-docs/` and `public/vendor/` are generated/vendored — never hand-edit.
- The six constraints from the audit prompt, one line each, with the reason.
- The client rule: plain scripts, globals, ordered in `index.html`; a new file is a new
  `<script>` tag with an ordering comment; never a module.
- **"One fact, one place."** If a decision is documented in a file header, other files link to it
  (`see game-runner.js:3`) rather than restating it.
- **"Verify before claiming."** A subagent's report of a security hole, a missing check, or a dead
  code path is a lead, not a finding, until the reporting session has read the lines.
- Before committing: `npm test`; before a class: `npm run check:release`. Env vars go in
  `.env.example` the same commit they are read.
- What needs asking first: adding a dependency, changing script order, touching `auth.js`'s cookie
  or signing code, anything in `content/lessons` (authored by a person).

**Tool 2 — `app/tools/check-env.js`, added to `npm test`.** Every `process.env.NAME` read under
`app/` must appear in `.env.example` or in an explicit allowlist of platform-injected names
(`VERCEL`, `NODE_ENV`, `PORT`, `KV_REST_*`, `UPSTASH_*`). Forty lines in the existing `check-*.js`
style. It would have failed on both variables I added today and on `TESTER_PASSWORD`.

**Not warranted:** a pre-commit hook (the CI already runs the suite; a hook that reruns
`check-boot.js` on every commit is a tax on the person doing the work); a second instructions file
per directory; any linter beyond `node --check`, until Phase 1 has made the files small enough that
lint output is readable.

---

## 5. What I chose not to recommend, and why

**Do not split `board.js`.** 2,339 lines, but one coherent domain (a canvas editor), a consistent
internal vocabulary (`paint*`, `begin*`, `*Selection`), and **9 commits** against `widgets.js`'s 37.
It is big; it is not churning. Splitting it buys readability and costs a week of regression risk in
the tab Jed called the wonkiest. Leave it until a feature demands it.

**Do not move to ES modules or add a bundler.** The globals-in-order model is the reason a
Chromebook on a filtered network can load this at all, and it is *why* the plan above can proceed
one `<script>` tag at a time with each step shippable. A module conversion is all-or-nothing.

**Do not upgrade to Express 5.** The `qs` override in `package.json` documents the exact
vulnerability and why the override is the right shape; Express 4 is not the risk here.

**Do not replace `tools/check-*.js` with a test runner.** Seven copies of a five-line `check()`
helper is the price of scripts a human can run singly and read; a fifth dependency to save 35 lines
is a bad trade. If Phase 2 and 3's new checks make the count unwieldy, revisit — after.

**Do not add a Redis client.** `store.js`'s `redis()` over `fetch` is 10 lines and correct.

**Do not strip the comments.** Several findings above were possible *only* because a comment said
"same as X" or "this used to be Y". The fix for contradictory comments is fewer places per fact, not
fewer comments.

**Do not rewrite the signed-cookie session.** It is correct for serverless, uses `timingSafeEqual`,
and the OAuth `state` handling is right. The only thing I would change is in Phase 7 (one `Secure`
rule).

**Do not introduce TypeScript.** There is none, the constraint is explicit, and the failure modes
found here are structural, not type-level.

**Do not act on the "AI bounce" or the agent-switcher affordance in this plan.** They are real UX
findings from the 15th call; they belong to the product backlog, and the session logging shipped
today is what will tell you whether children hit them.

---

*Uncertain, marked for verification rather than asserted:* F1 (sandbox state in real Chrome);
whether `check-mcp.js` duplicates `check-boot.js`'s server-spawn scaffolding (it does not — only
`check-boot.js` spawns; `check-phaser-parity.js` requires `jsdom` by absolute path where
`check-boot.js` uses the bare name, a minor inconsistency); whether the two asymmetries in the
guard chain (F8, Phase 2) are intentional.
