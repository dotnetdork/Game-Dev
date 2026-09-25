# The rework compared with the prior app

2026-09-25. A brief comparison, as agreed in the order of work (`00-direction.md`). The prior app is
described in `docs/app-brief.md` and critiqued in `research/05-critique-current-app.md`; the rework
is `PRODUCT.md`, `course-engine.md`, `briefs/` and `wireframes/02-first-run-engine.html`.

## At a glance

| | Prior app | Rework |
|---|---|---|
| **What it is** | A coding course: read and modify a real Phaser platformer across 24 lessons | A game-concepts course that is itself a game: the new developer at a studio, no code taught |
| **Who it's for** | ~10–15, some computer confidence assumed | 10–13, new to computers — assume nothing |
| **The AI** | A helper beside the lessons; separate Tutor and Build modes; deliberately limited | **The course itself:** a mentor, studio characters and a director that plans ahead; one conversation that teaches and builds |
| **How kids talk to it** | A chat box | Skyrim-style dialogue options, plus "say something else" |
| **A lesson** | ~1,700 words of reading with widgets; the build happens in another tab | A quest: feel it, name it, build it into *your* game, prove it, celebrate — beside the running game |
| **The kid's game** | A starter platformer everyone shares | Invented by the kid in minute one; always in the middle of the screen |
| **Remembering** | Nothing brings ideas back | Each concept returns at least four times over the weeks, disguised as play |
| **Progress & rewards** | XP, levels, stars as a price, leaderboards | Surprise prizes (tool powers, studio unlocks, cosmetics); a quiet stars bar; no leaderboards |
| **First contact** | A sign-in page, then a text lesson; the promised tour never built | "Your first day": the engine builds itself around the kid; playing their own game within ~5 minutes |
| **The look** | Dark navy "developer tool" shell; the AI hidden below 1440px wide | A Unity editor cut down for a first-timer; League orange as the one accent; built for 1366×768 |
| **Evidence** | Research + client conversations | The first live student test, which the rework answers point by point |

## What the rework keeps

- **The engine-style layout** (kept "until disproven"), now closer to Unity itself.
- **The League brand** and the engine-studio feel.
- **The ideas that worked:** live-tuning sliders (now the Inspector), demos you can feel, quiz
  feedback that explains wrong answers, the voice of the copy, and the Design board's spirit.
- **The engineering spine:** the AI relay and its safety checks ("reject, never repair"), the
  builder and its guards, per-student saves, the concept-before-use check (`vocabulary.yaml`).

## What changes

- **From reading to playing.** The student test's biggest complaints — boring, too many words,
  course and building disconnected — are answered by quests that happen *in* the kid's game.
- **From helper to course.** The AI moves from a side panel to the centre, with code (not the model)
  keeping score: scheduling, skills, completion and prizes.
- **From code to concepts.** Industry vocabulary and roles (Inspector, frame, VFX, QA, the jobs
  behind a game) replace syntax, so the transfer to Unity is the concept, not the language.
- **From one path to branch-and-rejoin**, and **from expected rewards to surprises**.

## What the rework drops (for now)

- **Leaderboards and the Gallery** — parked.
- **Code-debugging labs and the old widgets** — out.
- **The Console, code editor and file tree** — removed from what kids see in this version.
- **Hundreds of store assets** — one art style, still to be chosen.

## Also found along the way (prior app, still true today)

- Every typed message is logged with who sent it (`app/routes/ai.js:91-99`) — worth reviewing
  against the privacy brief regardless of the rework.
- Cost waste: an 8,000-token output cap for every agent, the whole game sent on every request, and
  cost tracking that mis-prices cached tokens (`research/08-ai-cost-and-originality.md`).
