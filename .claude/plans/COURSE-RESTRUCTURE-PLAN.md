# Course Restructure Plan — 5 modules × 3–4 lessons

**Written:** 2026-08-10 · **Owner:** Jay Sausa
**Scope:** `app/content/` — `course.yaml` and `lessons/*.md`. No app code changes.

## Why this exists

The course is currently **10 modules / 47 lessons**, scaffolded to prove the shape of the
curriculum. Two problems with using it as-is:

1. **It doesn't exercise the app.** Across 47 lessons there are only 8 runnable cells and
   **4 challenges**, against 42 quizzes — and 28 of those 42 are plain MCQ. Whole features
   (sliders, `predict`, `findbug`, challenge `win()`) are barely touched, so the content
   can't tell you whether the app works.
2. **It's thin.** Median lesson is ~20 lines. `tweens-and-motion.md` is 12 lines. There is
   nothing to *read*, which is the one thing the course claims to teach (reading real code).

**Jay's stated intent:** these lessons are a **functional test harness** for the app right
now, and will be rewritten later to be the real course. So the goal is a small set of
*deliberately dense* lessons that (a) exercise every widget type and app feature, and
(b) sit in a structure that survives the real content being dropped in later.

## Design constraints (from the UA docs)

From `.ua/ua6-specification.md` and `.ua/ua5-stage-2-analysis.md`:

- Students ~11–14, school-managed Chromebooks, browser only.
- **Fun first**, then understand. Hook with a playable game before any theory (S1).
- The pedagogy is **read / shape / debug real code and direct an AI** — not type from scratch.
- Every lesson should end with the student having *proved* something (S3), and challenges
  gate progression via `win()`.
- `ai: full | guided | off` is a per-lesson teaching decision, not decoration.
- Whole course targets ~10–12 h; this 5-module skeleton is a **slice**, not the full course.

## Target structure

Five modules, 3–4 lessons each — **18 lessons total** (down from 47). The arc is the same one
the 10-module outline had, compressed: *hook → literacy → read the code → change the code →
make it yours*.

| # | Module | Lessons | Teaching job | AI mode |
|---|---|---|---|---|
| 1 | **Welcome & Your First Change** | 3 | Hook: play the game, then change one number and see it move | `full` |
| 2 | **What Makes a Game a Game** | 3 | Design literacy: core loop, rules, feedback — the vocabulary | `full` |
| 3 | **Reading the Code** | 4 | The read-a-real-codebase lane: game loop, sprites, the shape of `game.js` | `guided` |
| 4 | **Changing the Code** | 4 | Movement, collisions, score — student modifies real systems | `guided` → `off` |
| 5 | **Make It Yours** | 4 | Juice, debugging, directing the AI, publish | mixed |

### Module 1 — Welcome & Your First Change
| Lesson | Job | Widgets / features exercised |
|---|---|---|
| 1.1 What You'll Build | Show finished games; set the goal | images, `run` (hello) |
| 1.2 A Tour of the Studio | Learn/Code/Play tabs, Files, Store, AI panel, console | `quiz: mcq` |
| 1.3 Change One Thing | Open `game.js`, change `moveSpeed`, press Run | `run` + `@slider`, `quiz: predict` |

### Module 2 — What Makes a Game a Game
| Lesson | Job | Widgets |
|---|---|---|
| 2.1 Goal, Feedback, Reward | The ingredients of fun | `quiz: mcq` with per-option `feedback[]` |
| 2.2 The Core Loop | Order the loop | `quiz: parsons` **with distractors** |
| 2.3 Rules & Fairness | Win/lose conditions, difficulty | `quiz: mcq`, `run` |

### Module 3 — Reading the Code
| Lesson | Job | Widgets |
|---|---|---|
| 3.1 The Game Loop | `preload` → `create` once, `update` ~60×/s | `run` + `@goal`/`@expect`, `quiz: predict` |
| 3.2 Sprites, Textures & Assets | Buy an asset in the Store, use its key | Store round-trip, `quiz: fillblank` |
| 3.3 Reading `game.js` Top to Bottom | Walk the real starter file; `CONFIG`, functions | `quiz: parsons`, `quiz: mcq` |
| 3.4 Challenge: Find the Bug | A broken `update()` | `quiz: findbug` + **`challenge`** |

### Module 4 — Changing the Code
| Lesson | Job | Widgets |
|---|---|---|
| 4.1 Input & Movement | Keys → velocity | `run` + `@slider`, `quiz: fillblank` |
| 4.2 Collisions & Overlap | `collider` vs `overlap` | `quiz: mcq`, `run` |
| 4.3 Variables, Score & UI | Track state, draw it | `quiz: predict` |
| 4.4 Challenge: Catch the Coins | Modify the real game until `win()` | **`challenge`**, `ai: off` |

### Module 5 — Make It Yours
| Lesson | Job | Widgets |
|---|---|---|
| 5.1 Juice: Tweens, Shake & Sound | Game feel | `run` + `@slider`, audio asset |
| 5.2 Debugging: Reading Errors | Console, common Phaser mistakes | `quiz: findbug`, `run` |
| 5.3 Directing the AI | Tutor vs Build; write a good instruction | `ai: guided`, tutor checkpoint |
| 5.4 Challenge: Ship It | Final change + publish to Gallery | **`challenge`**, publish flow |

### Coverage this guarantees

Every app feature gets exercised at least twice, and no lesson is a dead end:

| Feature | Before | After |
|---|---|---|
| `run` cells | 8 / 47 | 9 / 18 |
| `@slider` | 2 | 3 |
| `@goal` + `@expect` | few | 4 |
| `challenge` (`win()` gating) | 4 | **3, one per act** |
| `quiz: mcq` | 28 | 5 |
| `quiz: parsons` (+distractors) | 5 | 2 |
| `quiz: predict` | 3 | 3 |
| `quiz: fillblank` | 4 | 3 |
| `quiz: findbug` | 2 | 2 |
| `ai: full / guided / off` | all `full` in practice | 3 modes, deliberately assigned |
| Store → asset → use in game | never | 2 lessons (image + audio) |
| Publish to Gallery | never | 1 lesson |

## Scalability — why this survives the rewrite

- **Modules are acts, not topics.** hook → literacy → read → change → own. When the real
  content lands, lessons get inserted *inside* an act; the arc doesn't change.
- **Lesson ids stay descriptive and stable** (`the-game-loop`, not `3-1`), so reordering
  `course.yaml` never breaks a file reference.
- **One teaching job per lesson**, stated in its `summary:` front-matter. If a lesson needs
  two sentences to describe, it's two lessons.
- **Every module ends in a challenge or a build step**, so `win()`-gating is the spine —
  adding lessons never breaks progression.
- Stars per module scale with effort; XP stays 250–400/lesson so the level curve is unchanged.

## Execution

**Phase A — restructure (mechanical).** Rewrite `course.yaml` to the 5 modules above.
Keep and rename the 18 lesson files that map onto the new slots; `git rm` the other 29.
Verify the app still boots and the outline shows 5 modules / 18 lessons.

**Phase B — deepen (the actual work).** Rewrite each of the 18 to be genuinely dense:
target **60–120 lines**, every lesson opening with something to look at or run, and closing
with a check. Author against `app/content/AUTHORING.md`.

**Phase C — verify as a test harness.** Walk all 18 in the browser and confirm every widget
type renders and scores, all three challenges gate on `win()`, `ai: off` disables the Build
box, the Store round-trip works, and publish lands in the Gallery. Anything that breaks is an
app bug worth filing — which is the point of doing this.

**Phase D (later, not now).** Replace the placeholder prose with the real curriculum. The
structure, ids, and widget placement stay; only the words change.

## Open questions for Jay

1. **Keep the retired 29 lessons?** They contain usable prose for the eventual real course.
   Recommend `git rm` (they're in git history) rather than an `_archive/` folder that rots.
2. **Capstone genres** — the old Module 10 let students pick platformer / roguelike / arcade /
   collector, each needing a starter template. The 5-module slice assumes **one** starter
   (the Kenney platformer). Confirm that's fine for now.
3. **Course name** still TBD in `course.yaml` (`name: "Game Development — Level 1"`), pending
   the League's branding decision.

## Last updated

- 2026-08-10 · plan written. Not yet executed — Phase A awaiting go-ahead.
