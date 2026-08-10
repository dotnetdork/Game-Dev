# AI System Improvement Plan

**Written:** 2026-08-10 · **Owner:** Jay Sausa
**Scope:** `league-course-agent/` — `server.js`, `public/app.js`, `public/index.html`, plus a new `ai/` content directory.
**Goal:** turn the one-shot relay AI into a teaching system for 11–14-year-olds learning to **read and understand** JavaScript/Phaser, delivering the boss asks (agents/skills as markdown files; MCP integration) in an order where each stage works on its own.

---

## How to use this plan (for the assistant)

**Trigger phrase:** when Jay says **"walk me through the plan"** (or asks to start/continue/explain it):

1. Read this file top to bottom.
2. Determine the current stage: check the Progress tracker below, and verify against reality (`git log --oneline -15` and spot-check whether that stage's acceptance criteria hold in the code).
3. Explain the **current** stage to Jay in plain language: what it does, why it's next, what will change in the code, roughly how long it takes. Offer to also summarize the stages after it — don't dump all six unprompted.
4. Work **one stage at a time**. Confirm with Jay before starting implementation of a stage, and before moving past a stage.
5. When a stage's acceptance criteria pass, check it off in the Progress tracker, update "Last updated" at the bottom, and commit the stage as one coherent commit.
6. Never violate the Hard constraints section. If a stage seems to require it, stop and raise it with Jay instead.

Jay is the project lead and an intern learning this stack — explain decisions, don't just make them silently.

## Progress tracker

- [ ] Stage 0 — Cleanup & hardening
- [ ] Stage 1 — Context foundations
- [ ] Stage 2 — Agents & skills as markdown
- [ ] Stage 3 — Pedagogy loop
- [ ] Stage 4 — Tool use (Tier 1 validator → Tier 2 tool calling)
- [ ] Stage 5 — MCP server

---

## Hard constraints (do not violate)

1. **Must work on local Ollama today.** Current models: `qwen2.5-coder:7b` (coder), `qwen2.5:7b` (tutor/quiz/grader), sized for a 16 GB GPU. No cloud key exists yet. Every stage must degrade gracefully to these models.
2. **Provider switch is env-only.** The boss will likely provide an **OpenRouter** key with **Sonnet 5** — NOT confirmed. Never hardcode a provider or model; keep the `provider:model` per-agent spec in `.env` ([server.js:33-46](../league-course-agent/server.js)). When the key arrives, the only change should be editing `.env`.
3. **Keys stay server-side.** Never send keys or student PII to the browser or to model providers. Student code lives in `localStorage`; the server never stores it.
4. **Preserve the ops protocol.** The coder returns JSON "ops" (`config`/`functions`/`create`/`update`/`newFile`/`replaceFile`) applied browser-side by `applyOps()` with a `validJS()` parse-check + revert. Extend it, don't replace it.
5. **Jay edits content, not code.** Anything a teacher might tune (prompts, personas, teaching rules) belongs in editable markdown/YAML, same as lessons.
6. **No build step.** Plain JS/CSS files served statically. Splitting into more files is fine; introducing bundlers/transpilers is not.
7. **Known runtime gotchas:** audio must load via Blob URL (data-URI audio hangs Phaser's loader in the sandboxed iframe); don't wrap `Phaser.Game`'s constructor to auto-load assets; `fitStage()` must run after the console collapses; Reset restores both `game.js` and `main.js`.

## Current state (verified against code 2026-08-10)

- `POST /api/ai` ([server.js:215](../league-course-agent/server.js)) routes by `agent` (coder/tutor/quiz/grader) → one **stateless** model call → response. No conversation history is ever sent; the `chats` object in app.js is display-only.
- Coder gets `{message, code}` only — no lesson context, no file list, no owned-asset keys. Tutor gets lesson text (`currentLessonText`) but coder doesn't. The coder can't see `main.js` or student-created files, and invents asset keys because it doesn't know which of the 265 Store assets the student owns.
- System prompts are hardcoded strings: `buildSystem()` ([server.js:136](../league-course-agent/server.js)), `buildTutorSystem()` (:160), `AGENT_SYSTEMS` (:168).
- Lesson front-matter `ai: full|guided|off` only changes the input placeholder (`applyAIMode`, [app.js:453](../league-course-agent/public/app.js)) — the prompt sent to the model is identical in all modes.
- Coder edits apply silently ("Done.") — the student never reads the change, which inverts the course's read-the-code pedagogy.
- Quiz/grader endpoints exist but nothing in the UI calls them.

## Codebase review findings (feed Stage 0)

Verified 2026-08-10; "dead" means the symbol appears only at its definition.

**Security / robustness**
- **F1 — HTML injection from AI output:** bot replies render via `marked.parse()` → `innerHTML` ([app.js:900-902](../league-course-agent/public/app.js)). `<img onerror=...>` in model output executes in the app origin. Sanitize all marked output (bot replies and lesson bodies) with a **vendored** DOMPurify.
- **F2 — CDN single point of failure:** 20+ external `<script>`/`<link>` tags (cdnjs, jsdelivr, unpkg) plus Phaser-from-CDN inside every game iframe and League-hosted logo images. Blocked CDNs on school networks kill the app. Vendor everything into `public/vendor/` and switch the iframe builders (`startGame`, run cells, challenge cells) to the local Phaser.
- **F3 — Unescaped user text in innerHTML:** published game titles render raw in `renderGallery` ([app.js:1071](../league-course-agent/public/app.js)). Escape all interpolated dynamic strings with the existing `esc()` helper (currently used once).
- **F4 — Regex code-manipulation limits:** `insertIntoFn` miscounts braces inside string literals; `mergeConfig`/`parseConfig` non-greedy `\{...\}` breaks on nested CONFIG objects. Harden when Stage 3 touches this code; at minimum detect-and-refuse rather than mis-apply.

**Bugs / staleness**
- **F5 — Help page describes the old app:** still says Gallery = unlock example games, mentions "Showcase" ([app.js:1190-1199](../league-course-agent/public/app.js)). Rewrite for Store/Gallery reality.
- **F6 — Listener leak:** every `@expect` run cell and every challenge cell adds a permanent `window` message listener on each lesson render ([app.js:516](../league-course-agent/public/app.js), :659). Use one delegating listener installed once, keyed by token.
- **F7 — Ollama `num_predict: 2048`** can truncate a `replaceFile` response → broken JSON shown to the student. Raise for coder calls and/or handle truncation gracefully.
- **F8 — `resolveModel` edge:** default provider `openrouter` + blank agent spec sends the Ollama model name to OpenRouter ([server.js:40-46](../league-course-agent/server.js)).
- **F9 — rate-limit `hits` map never prunes** old entries ([server.js:59-65](../league-course-agent/server.js)).

**Dead code**
- **F10 — app.js:** `SKY_CODE`, `COIN_CODE`, `PADDLE_CODE` (~120 lines), stale `starcatcher` default in `loadState`.
- **F11 — server.js:** `extractCode`, `stripCode`, and the whole legacy server-side lane: `TUNABLES`, `ALLOWED_KEYS`, `applyEdits`, `currentConfig`, `GAME_FILE`, `/api/config`, `/api/files` (GET/read), `/api/save-file`, `/api/new-file`, `/workspace` static. Keep `/api/info`, `/api/ai`, and static serving of `public/` + `content/`.
- **F12 — public/game-host.html** unreferenced.
- **F13 — index.html:** dead CSS (`.tutorcell*`, `.docsframe`) and duplicate selector blocks (`.cost`, `.owned`, `.quiz-check`, `.quizcell`, `.quiz-h`, `.mcq-opt`, `.folderhead`) where later rules silently override earlier ones.

**Structure**
- **F14 — monoliths:** `app.js` (1,253 lines) and `index.html` (610 lines, ~455 of CSS). Split without a build step: `public/styles.css` + ordered plain scripts, e.g. `templates.js` (starter code strings), `project.js` (localStorage project + ops applier), `widgets.js` (run/quiz/challenge cells), `game-runner.js` (startGame/fitStage/audio/console), `ai.js` (chat + /api/ai), `pages.js` (store/gallery/board/docs/help), `main.js` (boot + router). Keep function names identical so diffs stay reviewable.

The core architecture is sound (client-side project, sandboxed iframe, server-relayed AI with browser-applied ops, authored content). The findings are prototype debt, not a redesign.

---

## Stage 0 — Cleanup & hardening (~1 day)

**Why first:** every later stage edits these files; deleting dead code and splitting the monoliths first makes each later diff smaller and safer, and F1/F2 are real risks for a kids' product on school networks.

Do, in order:
1. Delete dead code: F10, F11, F12, F13. Add `workspace/` to `.gitignore` and `git rm --cached` the tracked scratch file (known housekeeping item).
2. Vendor all CDN libs to `public/vendor/` (F2): CodeMirror 5 + addons, JSHint, Prettier standalone, js-yaml, marked, MDI font (+woff2), Phaser 3.80.1, DOMPurify. Update `index.html` and all three iframe-HTML builders. Download League logo images into `public/img/` per the note at the top of index.html.
3. Sanitize (F1): wrap every `marked.parse` in `DOMPurify.sanitize`; apply `esc()` to user-derived strings (F3).
4. Fix F5 (Help copy), F6 (single delegating message listener), F7, F8, F9.
5. Split files per F14 (mechanical moves only — no logic changes in the same commit as moves).

**Acceptance:** app runs fully offline except AI calls (verify with DevTools network tab: zero external requests); starter platformer + assets + lessons + quizzes + challenges all work; `wc -l` shows no file over ~400 lines; help page matches the real nav; all existing behavior preserved.

## Stage 1 — Context foundations (~1–2 days)

**Why:** the single biggest reason the AI feels dumb. Kids ask short referential follow-ups ("what does that mean?", "no, the other one") and the model has no history. The coder invents asset keys and APIs largely because it can't see what exists.

1. **Conversation history:** client sends the last ~6 turns from `chats[mode]` as `history: [{role, content}]`; cap each turn (~1,000 chars) and the total (~6,000 chars — `num_ctx` is 8192 on Ollama). Server inserts history between system and the new user message in `callAI()` for all three providers. Histories stay separate per agent mode.
2. **Coder context parity:** send `lessonContext` (same text the tutor gets + lesson id/title), `files` (names + contents of all project files, capped, truncated biggest-first with a marker), and `ownedAssets` (`{key, type}` from the same source `ownedAssets()` uses). System prompt must state: **only these asset keys exist; never invent keys.**
3. **Make `ai: full|guided|off` real:** send the mode with each coder request; server appends a guided-mode prompt section (refuse vague requests, demand specifics, minimal edits, one-sentence explanation). `off` keeps the existing client-side block.

**Acceptance:** follow-ups work ("make it faster" → "even faster" → "undo that"); coder references real owned asset keys; guided mode observably refuses "make it cooler"; zero `.env` changes needed on Ollama.

## Stage 2 — Agents & skills as markdown (~1–2 days) — boss ask #1

**Why:** teaching behavior must be tunable by a teacher, not locked in JS string literals. Mirrors the Claude Code skills pattern and the existing lesson-authoring pipeline.

Layout:
```
league-course-agent/ai/
├─ agents/   coder.md · tutor.md · quiz.md · grader.md
└─ skills/   phaser-rules.md · guided-mode.md · explain-a-line.md · kid-communication.md
```

Format — YAML front-matter + markdown body (js-yaml is already server-available via npm; add it as a server dep or parse the simple front-matter with a regex):
```markdown
---
name: coder
description: Edits the student's Phaser game via JSON ops.
model: ""            # optional override; blank = .env per-agent spec
skills: [phaser-rules, kid-communication]
---
You are a coding assistant inside a kids game-dev course…
```
- Template placeholders filled at request time: `{{gameCode}}`, `{{files}}`, `{{lessonContext}}`, `{{ownedAssets}}`, `{{aiMode}}`, `{{history}}`. Simple `{{var}}` replacement, no template library.
- Loader (`ai/loader.js`): read agent file → resolve `skills:` → concatenate → fill placeholders. Cache by mtime (hot-reload without restart). **Fallback:** if files are missing/malformed, use the current hardcoded strings and log a warning — a markdown typo must never 500.
- Model precedence: `.env` per-agent spec > agent front-matter `model:` > default provider.
- Port the hard-won rules from `buildSystem()` into `coder.md`/`phaser-rules.md` (smallest-change-first, no `Phaser.Game`, no HTML-canvas Graphics methods, config-for-tunables, JSON-only output).

**Acceptance:** editing `tutor.md` changes behavior on the next request without restart; broken front-matter falls back cleanly; stock files reproduce today's behavior.

## Stage 3 — Pedagogy loop (~3–4 days) — the actual point

**Why:** the course goal is kids who read code. Today the coder mutates the file and says "Done."

1. **Propose → read → accept (highest value in the plan).** Coder responses become a proposal card: one plain sentence of *what and why* + a line-diff preview + **Apply** / **No thanks**. Nothing touches the project until Apply; Apply runs the existing `applyOps()` + `validJS()` path unchanged. Mostly client-side in `ai.js`: hold `ops` pending, compute the preview by applying to a copy and diffing (~30-line LCS or a tiny vendored diff lib). Require a `why` field in the coder's JSON (add to `coder.md`); fall back to `reply` when small models omit it. Collapse the diff by default for config-only changes; expand for code changes. While hardening here, address F4 (refuse rather than mis-apply when the regex applier can't find a clean insertion point).
2. **Explain-this-line.** CodeMirror gutter click (or context menu) on any line → `{agent:'tutor', skill:'explain-a-line'}` with the line, ±10 surrounding lines, file name → 2–3 kid-friendly sentences. Server: allow an optional allowlisted `skill` field on `/api/ai` that appends one skill file.
3. **Wire the quiz agent (minimal viable).** After a student *applies* a code-changing proposal, roll ~1-in-3 to show one mcq comprehension question about the change (quiz agent gets the diff + lesson context; reuse the lesson-quiz rendering). Wrong answer → show explain, no penalty; right → small XP; never blocks. This is enough to call quiz/grader "wired" — defer anything fancier.
4. **Socratic tutor** in `tutor.md`: hint + where-to-look first; full answer if the student asks again or says they're stuck; never writes whole features (that's the coder's job, via proposals).

**Acceptance:** no AI edit reaches `game.js` without the student seeing a diff and clicking Apply; explain-a-line works from the editor; applied code changes sometimes trigger a one-question check; tutor demonstrably hints before answering.

## Stage 4 — Tool use (~2–3 days Tier 1; +2 for Tier 2)

**Why:** models guess (asset keys, Phaser APIs, lesson content) because they can't look anything up. Designed around constraint #1 — small local models are unreliable at multi-turn tool calling.

- **Tier 1 — deterministic validation (works on Ollama; build first).** After the coder returns ops, the server scans proposed code for known-bad patterns (`cubicCurveTo`, `bezierCurveTo`, `arcTo`, `new Phaser.Game`) and asset keys not in the student's owned list. On violation: auto-retry once with the error appended to the conversation; if still bad, return a friendly "that change used something that doesn't exist" message. A validator, not model tool-calling — works with any model, and also catches F7-style truncation (unparseable JSON → retry once).
- **Tier 2 — real tool calling (per-provider opt-in via `.env`, e.g. `CODER_TOOLS=1`; default off for Ollama).** Tools: `get_lesson(id)`, `list_owned_assets()`, `read_file(name)`, `search_phaser_docs(query)`. Anthropic tool-use blocks / OpenRouter `tools` param; loop up to ~4 tool rounds server-side. Off → Tier 1 behavior.
- Implement tools as plain functions in `ai/tools.js` with a name/description/JSON-schema table — **this table is the future MCP surface.**
- Data sources: lessons from `content/`; asset catalog moved to a JSON file that `assets-manifest.js` wraps (one source of truth for browser + server); Phaser reference = grow `phaser-rules.md` into a curated mini-reference of the ~40 APIs the course uses. No live fetches of phaser.io.

**Acceptance:** on Ollama, invented keys/APIs are caught and corrected or explained; with a tools-capable provider, the coder demonstrably calls `list_owned_assets` instead of guessing; switching tiers is a `.env` edit.

## Stage 5 — MCP server (~1–2 days) — boss ask #2

**Why last:** MCP is a protocol wrapper around tools/resources/prompts; until Stage 4's tool table exists there is nothing real to expose. Done last it's a thin, honest layer.

- `ai/mcp-server.js` using `@modelcontextprotocol/sdk` (stdio): expose the Stage 4 tool table as MCP **tools**, lessons as MCP **resources** (`lesson://<id>`), agent/skill markdown as MCP **prompts**.
- Consumers: (a) the course backend may route Tier-2 calls through it, but in-process calls are fine — don't force it; (b) **Claude Code** via a repo-root `.mcp.json`, so future sessions can query the real asset catalog and lesson content while authoring lessons. Consumer (b) is what makes MCP genuinely useful today.
- Read-only until there's a reason otherwise.

**Acceptance:** `claude` in this repo can list assets and read lessons via MCP; the server runs standalone with `node ai/mcp-server.js`.

---

## Provider notes (for the .env switch when the key arrives)

- Expected: OpenRouter key, coder → Sonnet 5. **Verify the exact OpenRouter model id at that time; don't guess ids in code.** Tutor/quiz can stay local or move — per-agent choice already works.
- OpenRouter path already supports `response_format: {type:'json_object'}` ([server.js:193](../league-course-agent/server.js)); add `tools` there in Stage 4.
- Keep Ollama defaults working forever — offline/demo/no-budget fallback; the classroom may need it.
- Rate limiting matters more with a paid key: keep it, consider a lower `max` for the coder agent. Note `studentId` is client-generated and spoofable — acceptable until the auth lane lands.

## Testing checklist (run per stage)

1. `cd league-course-agent && npm start` with Ollama running → full chat + edit + apply loop works.
2. Same with `.env` pointing at a cloud provider (when available) — no code changes needed.
3. Kill Ollama mid-session → friendly error, no crash, UI still usable.
4. Fresh browser profile (empty localStorage) → starter platformer + free assets work end-to-end.
5. Regression: audio loads (Blob URL path), Reset restores both files, Play view fits 4:3, run/quiz/challenge cells work.
6. From Stage 0 on: DevTools network tab shows zero external requests (fully offline except `/api/*`).

## Last updated

- 2026-08-10 · plan v2: added Stage 0 from full-codebase review (security, dead code, structure findings F1–F14), walkthrough protocol + progress tracker, stages renumbered.
