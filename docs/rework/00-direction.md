# The rework — direction

Jay, 2026-09-24. Written down as said, before any research or design, so the research and every
later decision can be checked against it. This supersedes the course shape in `.ua/` and
`PRODUCT.md` where they disagree; those get revised from here, not the other way round.

## What the student test found

The first test with live students. It is the first evidence from real users this project has had
(until now: research + two client conversations).

- **It bored them.** The courses aren't fun.
- **They didn't know where everything was.**
- **They couldn't tell what to do.**
- **The UI was overwhelming.**
- **Too many words for kids.**
- **The course and the building are disconnected.**
- **The lesson widgets were implemented poorly:** sliders, quizzes, labs, practice.

## The new direction

- **AI is the focal point of the course.** The builder and the tutor are to be merged into one
  chat — decided, not yet built: the code still has two modes and a toggle (`app/public/js/ai.js:7`,
  `app/public/index.html:268`). The tutor is right as it is; the job is to improve it, not replace
  it. The AI is no longer held back from building.
- **A game-concepts course, not a programming course.** Teach the concepts of games and the
  concepts around programming, **without teaching syntax or code for the time being.**
- **Teach the concept, build it with AI.** A kid learns a concept, then builds it into their game
  by directing the AI.
- **Kids who don't want to read walls of text still learn the core concepts of games** — industry
  ideas, phrased in a way that is fun to them and transfers later.
- **They don't know they're learning because they're having so much fun, but the concepts stick
  like glue** and prepare them for Unity, Godot, Unreal, or industry fields of game dev.
- **Expose them to the roles** and let them take a crack at each one, so they get an idea of what
  game dev is about.
- **The goal: spark the flame in the next generation** of game devs — programmers, animators,
  artists and the rest.

## Revision — a standalone rework (Jay, later the same day)

- **The current app becomes a reference, not the starting point.** The rework is a fresh,
  standalone wireframe with fresh course content. Reuse what works; don't carry things over by
  default. "If current is great we end up with the same app, but we won't."
- **What to keep from the prototype:** not the content, but the overall **structure and layout
  (until disproven)**, and the **features, ideas and design aspects that work**.
- **It should mimic a real game engine but operate as a course driven by AI** — an AI that **learns
  the student and adapts the content** to them.
- **Audience, sharpened: 10–13 year olds who are new to IT, CS, and computers in general.** Assume
  nothing — not files, not tabs, not keyboard shortcuts, not right-click.
- **Features come back one at a time, in the wireframes, as we decide to.** The ledger of what is
  in, out, or waiting is `features.md`; the wireframes live in `wireframes/`.

## What happens to the app

- **Strip it down to its core,** then build back, with Impeccable, only the features we decide are
  necessary.
- **The layout is liked,** but it may need extensive work after what the students showed.
- **Leaderboards:** probably not necessary.
- **Gallery:** not necessary for now.
- **Store:** probably one chosen asset size/style instead of hundreds. More on that later.
- **Lesson widgets** (sliders, quizzes, labs, practice): poorly implemented; to be rethought, not
  carried over.

## How we get there

1. **Research first** — think about this deeply with Impeccable's UI/UX tools for a while before
   building anything.
2. **Wireframe** — low-fidelity, layout and flow only, before code (Impeccable has no wireframe
   step of its own; see the session notes: `/impeccable shape` for briefs, grey-box wireframes for
   layout, then build).
3. **Rebuild** feature by feature with Impeccable.

## Still open

- What "the core" is, exactly: which surfaces survive the strip-down.
- Whether kids ever see the game's code at all in this version, or only the running game.
- The store's single asset style.
- How the roles map onto the course (a role per module? a role per concept?).
- Course length and shape (the old spec: ~10–12 hours, 24 lessons in 6 modules).
