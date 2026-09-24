# What the app is made of — inventory for the strip-down

Research for the rework (`../00-direction.md`), 2026-09-24. A read-only survey of `app/` by a
research agent; line counts from `wc -l`. File:line references are leads — check them before
acting (`CLAUDE.md`: verify before claiming). One claim was checked directly and is marked ✔.

## The headline

**✔ The builder and tutor are not merged in code yet.** Two modes and a toggle (`index.html:268`
`#modeToggle`), two thread sets (`ai.js:7` `chats = { coder: [], tutor: [] }`, `course.js:346`), two
agents (`routes/ai.js:277` tutor, `:328` coder). Learn and Design force Tutor mode
(`course.js:356-370`). Merging means rewriting the tutor's "switch this panel to Build" hand-offs
and the coder's `{{practiceTask}}` refusal (`coder.md` ~50).

## Features, where they live, what they touch

| Feature | Where | Tests | Coupling / cost to remove |
|---|---|---|---|
| **Gallery** | `pages.js:303-332`; local `state.published` only, no backend | none | Trivial. Nav button + Help text. |
| **Leaderboards** | `pages.js:334-494`; roster `sampleBoard=[]` is empty | none | Low. CSS ~1944-2140; badge case (`pages.js:634-708`) also opens from the footer. |
| **Store** | `pages.js:52-302`; `assets-manifest.js` (1.39 MB generated); `public/assets/` 14 MB, 19 packs | check-assets, check-guards | **Heavy.** Preload in `game-runner.js:30-116`, asset picker `files.js:70-190`, owned assets sent to the AI `ai.js:551-575`, `bad-asset` guard `routes/ai.js:468`, `search_store`/`list_owned_assets` tools, MCP. If every asset is simply owned, `assetOwned` and the Stars economy can go. |
| **XP / Stars / badges footer** | `progress.js` (397); markup `index.html:406-428` | check-state | Awarded by widgets.js and ai.js; spent in Store; shown in Leaderboards. |
| **Docs (Phaser API)** | `docs.js` (1540); `public/phaser-docs/` (989 generated files) | check-credits, check-phaser-parity | **Keep the index even if the tab goes** — the AI looks things up in it. |
| **Help** | `pages.js:508-525`, hard-coded | none | Text describes Store, Gallery, Tutor/Build, Practice — goes stale with any change. |
| **Credits** | `pages.js:526-633`; `/api/credits` | check-credits, check-boot | Low. Keep (CC0 attribution). |
| **Learn tab / outline** | `course.js` (404); `widgets.js:1131-1431` (selectLesson, paint, completion) | check-boot, check-lessons, check-vocab, check-mcp | Completion is built on widget activity keys (`widgets.js:1205`) — split out, don't delete. |
| **Lesson widgets** | `widgets.js` (1431), `demos.js` (521), `quiz.js` (386), `lab.js` (763) | check-lessons, -challenges, -quiz, -grade, -sandbox, -prompts, -questions | **Deep.** Agents lab-tutor, quiz, grader + `quiz-check.js`, `grade-check.js`; ai.js hooks `maybeAskQuiz`, `gradePractice`, `askAboutPractice`; router opens labs by URL. |
| **Design board** | `board.js` (2470); CSS 1055-1508 | check-prompts | `design.md` in the project (project.js ×6, editor.js, files.js, progress.js); ai.js `boardPayload`/`applyBoardOps`; design-coach agent. |
| **Code tab** | `editor.js` (290), `lazy.js`, `highlight.js`; review bar `index.html:184-196` | check-boot | Where AI proposals are reviewed today. |
| **Play / game runner** | `game-runner.js` (490), `sandbox-shims.js`, `starter-code.js` | check-sandbox, check-assets | **Core.** |
| **Console** | `console-dock.js`, `console-panel.js` | check-gamelog | The game log is sent to the AI. |
| **Files + Inspector** | `files.js` (394): tree `index.html:64-71`; Inspector sliders over config.js `:72-85` | none | Inspector = live tuning of the kid's game — relevant to "dials." |
| **Auth** | `auth.js` (636), `login.html` | check-boot, check-env | **Ask first** (`CLAUDE.md`). |
| **Storage / sync** | `storage.js`, `project.js`, `sync.js`; `store.js` (Redis over fetch); `/api/state` | check-state, check-boot | **Core.** |
| **Telemetry** | `telemetry.js` (client + server), `/api/events`, `/api/usage` | check-session | Guarded; removable. Useful for the next student test. |
| **Dev mode** | `dev.js` | check-release | Low. |
| **MCP server** | `ai/mcp-server.js` | check-mcp | Low. |

`styles.css` is 3317 lines with interleaved sections (shell 1-270 & 444-585; AI chat 790-930; store
900-1006; board 1055-1508; docs 1509-1975; leaderboards 1944-2140 & 2610-2766; quiz 2139-2216;
review 2216-2278; lesson strip/glossary/lab 2301-2610; reading surface 2804-3252).

## The AI layer

| Agent (`app/ai/agents/`) | Lines | Job |
|---|---|---|
| tutor | 62 | Explains; never edits. |
| coder | 196 | "Build helper"; returns JSON ops. |
| design-coach | 138 | Tutor on the Design tab; may emit `BOARD:` lines. |
| lab-tutor | 52 | Tutor inside a lab. |
| quiz | 23 | Writes a question after an applied AI change. |
| grader | 96 | Judges practice steps. |

Skills: `kid-communication`, `phaser-rules`, `guided-mode`, `explain-a-line`. One `POST /api/ai`
serves all six (`routes/ai.js`, 560 lines): whitelist, 40 req / 10 min rate limit, a context object
(lesson, practice, lab, board, owned assets, files, game log). The coder's JSON ops go through four
corrective guards (no-ops, bad-api, bad-key, bad-asset) with one retry. Client (`ai.js`, 971):
config-only changes apply immediately; code changes become a proposal reviewed in the Code tab,
validated, then written; an AI quiz may follow. Lesson AI policy `full/guided/off` from front-matter
— **all 24 lessons are `full`**.

**The tutor prompt, in its own words** (`ai/agents/tutor.md`): "make them understand things and
answer their questions. It is not to write their game"; "about 2-4 short sentences"; "DO NOT WRITE
CODE FOR THEM TO COPY"; hint before answering, and if asked again give the real answer — "Being stuck
is not a teaching opportunity, it is a dead end."

## The layout

`index.html`: top bar (brand; Courses / Store / Gallery / Leaderboards; Docs / Credits / Help) → a
three-column grid (`styles.css:128-146`; left 230–280px, right 320–560px): **left dock** (outline,
files or inspector, per tab) · **centre** (view bar with breadcrumb, Learn / Design / Code / Play
tabs, transport controls, assistant button; lesson rail; the view; console with resizer) · **right
dock** (AI: collapse, title, mode toggle, model tag, thread picker, messages, input) → full-page
views replace the grid → a full-window lab overlay → status bar (version, reset, badges, Stars, XP,
level). Responsive tiers in `ui.js:26-200` (≥1440 / ≥1180 / below; docks become slide-overs).

## Core vs. removable

**Core:** server (`server.js`, `routes/ai.js` tutor + coder, loader, provider, models, guards,
tools, auth, store), client (`dom`, `events`, `storage`, `sync`, `project`, `ops`, `starter-code`,
`game-runner`, `sandbox-shims`, consoles, `editor` switchView + review, `ai`, `course`, `router`,
`ui`, the shell), `phaser-docs/` as the AI's index, vendor. Tests: check-boot, -html, -state,
-guards, -coder, -prompts, -sandbox, -gamelog, -env, -encoding.

**Removable, cheapest first:** Gallery → Leaderboards → Help (rewrite) → Telemetry (but useful for
testing) → Docs tab (keep the index) → XP/Stars/badges → Store (shrink; heavy) → Design board →
lesson widgets (deepest; lesson completion must be split out first).

## Content

- `course.yaml`: 6 modules, 24 lessons (engines 3, ideation 3, mechanics 5, phaser 5, architecture
  4, assets 4).
- Fences across the 24 lessons: ~52 `run`, 48 `quiz`, 25 `yourturn`, 22 `challenge`, ~21 plain code.
- **About 18,700 prose words + 21,800 inside widgets ≈ 1,700 words per lesson.** (Prose counts
  include figure HTML, so slightly high.) The shortest lesson is ~1,200 words; the longest ~2,100.
- Concept material that already exists: the engines, ideation, mechanics and assets modules are
  mostly concept prose (core loop, feedback, flow, risk/reward, progression, scope, juice, sound);
  14 SVG concept diagrams in `content/images/`; ~30 screenshots of real games.
- **`docs/archive/course-v1/`**: 47 short lessons of ~100–240 words, several about **roles and
  concepts** (`people-behind-a-game`, `designers-programmers-artists`, `producers-and-qa`,
  `animators-sound-level`, `genres`, `ingredients-of-fun`, `minecraft-case-study`, `playtesting`,
  `tour-of-engines`). Much closer to the low-text target, and on-topic for "expose them to the
  roles."
- Also unread and possibly relevant: `docs/curriculum-outline.md`, `docs/ai-system-brief.md`,
  `docs/layout-and-engine-feel.md`, `docs/build-mode-brief-2026-09-20.md`.
