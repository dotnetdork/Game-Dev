# Is the pivot worth it? Three paths compared

2026-09-25. A decision analysis grounded in the code, by an architecture agent, kept close to as
returned. **All effort figures are estimates** for one maintainer working with AI. Checked by hand:
the 9 code-structure lessons (`content/course.yaml`: the `phaser` module's 5 + `architecture`'s 4),
`widgets.js:1131` `selectLesson` / `:1378` `completeLesson`, `check-boot.js:206` asserting
CodeMirror loads at boot, `ui.js:37` `TIER_WIDE = 1440`. The old app's typed-message telemetry was
temporary and intentional for a test session (Jay) — not counted as a defect.

> **Jay's corrections (2026-09-25):** (1) the project uses git and is in active development, not
> production, so nothing is ever "down" during a transition — that risk, listed for path 2 below,
> does not apply; (2) no building until the wireframes are worked out; (3) the week estimates are
> too cautious — the code is days, not months; the real long poles are authoring content and testing
> with kids. Read the effort figures below as relative, not as a schedule.

## Recommendation

**Pursue the pivot, staged, as path 3: a new front end that reuses the old backend and the old
client's game core.** Don't spend real effort on path 1: "boring" and "course and building
disconnected" come from how the course is built, which polish can't fix. Path 2 reaches the same
product as path 3 at higher cost and risk. The full "AI is the course" machine is large and
unproven — **prove one shift with real kids first.**

## Path 1 — fix the old course as it is (≈9–12 person-weeks)

Fixable: the AI visible at 1366 (`ui.js:37`, ~1 wk) · one chat (`ai.js:7`, `#modeToggle`, the
tutor's hand-offs, ~1–1.5 wk) · nav cut to ~2 (~0.5 wk) · onboarding (~1 wk) · words cut ~80% (~40k
words; a person must do it — lessons are ask-first; ~3–4 wk) · better widgets (~2 wk) · restyle to
`DESIGN.md` (~2 wk).

**Not fixable by polish:**
- **It still teaches code to kids new to computers.** 9 of 24 lessons are program structure
  (`values-and-variables`, `decisions-and-repeats`, `scenes-create-update`,
  `input-movement-collision`, `reading-an-error`, `game-state`, `entities-and-components`,
  `events-not-tangles`, `data-out-of-code`); ~52 `run` cells; `yourturn` checks are code rules.
- **Course and building stay disconnected** — building still means changing code in another tab.
- **It stays a reading course with interactive bits.** Shorter is less boring, not fun.

| Student-test finding | Path 1 answers it? |
|---|---|
| Overwhelming | Yes |
| Didn't know where things were | Mostly |
| Couldn't tell what to do | Partly |
| Too many words | Yes, if the cut is really made |
| Widgets poorly made | Partly |
| Boring | Weakly |
| Course and building disconnected | Partly |

## Path 2 — the pivot inside the old client, stripping clutter (≈14–21 person-weeks)

- **Backend carries over** (same as path 3): `server.js`, `auth.js` (ask-first, untouched),
  `store.js`, `telemetry.js`, `provider.js`, `models.js`, `guards.js`, `tools.js`, `usage.js`, the
  `quiz-check`/`grade-check` pattern, `phaser-docs/`, vendor, assets. Modified: `loader.js`,
  `routes/ai.js` (+ the cost fixes in `08`). New: `routes/studio.js`, `studio-content.js`,
  `turn-check.js`, `content/studio/`, new agents and skills (`07` §4).
- **Old client:** keep `dom`, `lazy`, `events`, `storage`, `ops`, `starter-code`, `sandbox-shims`,
  `game-runner`; modify `project.js`, `sync.js` (learner-card key + merge rule), `files.js` (keep the
  Inspector sliders), `router.js`, `ui.js`; delete `widgets.js`, `lab.js`, `quiz.js`, `demos.js`
  (salvage its logic), `board.js` (2,470 lines), `docs.js` (1,540), `pages.js` (741), `editor.js`,
  `highlight.js`, the consoles, CodeMirror, most of `course.js` and `styles.css`.
- **Coupling to untangle:** `widgets.js` owns lesson selection and completion (called from
  `course.js`, `router.js`, `ui.js`, `events.js`); `progress.js`'s global `state` is read by
  `game-runner.js`, `project.js`, `sync.js`; `ai.js` (971 lines) is woven through with two modes,
  lessons, the board and practice — effectively a rewrite; `index.html` is built around the four
  tabs, and every removed script changes the (ask-first) script order.
- **Tests:** `check-boot` (outline rows, lesson `h1`, CodeMirror at boot), `check-lessons`,
  `-challenges`, `-quiz`, `-questions`, `-vocab`, `-credits` all go red together.
- **Risks:** the old app unusable in class during the transition; a long red suite; old-shell
  assumptions leaking into a design that says not to borrow them; dozens of ask-first deletions.

## Path 3 — a new front end on the old backend (≈11–17 person-weeks)

The backend is effectively the same as path 2; **the paths differ almost entirely in the client.**
A new page (e.g. `studio.html`, its own ask-first script order) loads the old core files unchanged —
`dom`, `events`, `storage`, `ops`, `starter-code`, `sandbox-shims`, `game-runner`, `sync`, `project`
— plus a small shim defining the `state` those expect (~2–4 days), and new scripts: shell, mentor
dock, shift runner, Inspector (port `files.js`'s sliders), scheduler/card engine. Styles from
`DESIGN.md`. One server route.

**Why it beats path 2:** nothing to untangle (~7,000 client lines avoided); the existing checks stay
green; the old course keeps working as fallback and reference; deletion becomes one deliberate
later commit. **Risk:** two front ends for a while — keep the shared core files untouched.

## Old course content worth salvaging (~1–2 weeks of distilling, saves several of writing)

- **Concept prose** from the engines, ideation, mechanics and assets modules (~12 lessons) → concept
  web nodes (`kid:` line, `feel_it`, `misconceptions`). Keep the voice, drop ~95% of the words.
- **Quiz `explain:` lines and per-option feedback** → misconception material for retrieval options.
- **SVG diagrams:** keep `core-loop`, `game-loop`, `flow-channel`, `juice-layers` as card art; park
  the code diagrams.
- **~30 real-game screenshots** as "real studios do this" references (credits already tracked).
- **`demos.js`** (fps, gravity) → feel-it demos and Inspector moments — the critique's best-rated
  interactions.
- **`vocabulary.yaml`** → the concept web's seed and `check-web` (drop the syntax half).
- **`glossary.yaml`** → plain-word glosses under real engine words.
- **`questions.yaml`** → partly, for dialogue options.
- **`docs/archive/course-v1`** (47 lessons, 100–240 words): the role lessons as personas and quest
  outlines; the `challenge-*` minigames and `findbug` quizzes as "broken game from a customer"
  shifts, spotted by playing rather than reading code.
- **`starter-code.js`'s platformer** as the base game; its CONFIG numbers are the Inspector's
  fields.

## The smallest slice that proves it (≈3–4 person-weeks)

1. `studio.html` in the `DESIGN.md` look, reusing `game-runner` / `project` / `ops` / `storage`.
2. A 3–5 minute first-run lite: the kid names their game and it's running.
3. **One sound-department shift, fully authored, zero LLM calls:** a customer's game has silent
   coins → a sound-matching minigame → the sound lands in the kid's game → they play it and tune one
   Inspector slider → a milestone ticks.
4. Optionally one builder call through the existing coder for "make it sparkle."

**Test:** 6–10 kids, one session, one shift, scored against the seven student-test findings —
ideally beside a trimmed old lesson. It answers the only question that matters before building the
director and characters: **is doing the job fun, and do kids know what to do?** If not, you've spent
~4 weeks finding out, not ~15.

**Stopgap for the old app** if classes need it meanwhile: at most ~1 week — the AI visible at 1366,
nav clutter hidden. Not the full path 1.

## Main risks

1. **Fun isn't proven** — shifts could become tapping with extra steps (Jay's own concern about
   wireframe 02).
2. **Authoring load** — ~30 quests with scripted fallbacks plus the concept web, whatever the path.
3. **The builder failing silently** with no code visible; 5–10 s waits; cost.
4. **Privacy** — learner card and safeguarding decisions; new routes log option ids only, with an
   explicit switch for test sessions.
5. **Ask-first items** — a new script order, auth changes for a teacher view, retiring the old app.

## Summary

| Path | Effort (person-weeks) | Risk | Answers the student test |
|---|---|---|---|
| 1. Fix the old course | 9–12 | Low technical; high that it's still boring | Partly — clutter and words, not boredom, the disconnect, or syntax for beginners |
| 2. Pivot inside the old client | 14–21 | High | Fully, if it works |
| 3. New front end, old backend | 11–17 | Medium | Fully, if it works |
| First slice (path 3, one shift) | 3–4 | Low | Tests the core claim with kids |
