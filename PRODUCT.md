# Product

<!-- impeccable:product-schema 1 -->

Written by `/impeccable init` on 2026-09-24. This is the product record Impeccable reads before any
design work. It records product truth only: no palettes, type or components. The longer accounts it
draws on are linked rather than restated.

**The planning and research live in `.ua/`** (UA Framework, owned by Jay): `ua1` opportunity notes
and client conversations, `ua2` positioning statement with its evidence, `ua5` landscape,
stakeholders and jobs-to-be-done, `ua6` screen-by-screen specification, `UA0` project status. Go
there for the *why* behind anything below. Some counts in `.ua/` predate the restructure (it
describes 10 modules / 47 lessons; the course is now 6 / 24, see `app/content/course.yaml`); the
positioning and research hold. The current state of the app is `docs/app-brief.md`; working rules
are `CLAUDE.md`.

## Platform

web

## Users

**Primary: students aged ~10–15** at The League of Amazing Programmers (the League names 11+ as the
floor; engaged 10-year-olds have been observed — `.ua/ua2-positioning-statement.md`, Target
customer), working on **school-managed Chromebooks** (8–16 GB, ChromeOS) behind filtered networks,
in camps and classes of about 20 with one instructor. Short, mixed attention spans; motivated by
making something and showing it, not by grades or ranking.
Design work optimizes for the child at the keyboard. Most of them do not know what game to make, and
the rest can lose weeks to a single sprite (`docs/app-brief.md` §2).

Secondary: League instructors (the course has to run unattended at class scale, with the AI standing
in for a teacher at their shoulder, and the teacher able to explain the code a challenge points at)
and parents (who want their child safe, learning a real skill, and with a game to show family).
Neither is the audience the interface is shaped around.

The client is the League itself (Jed Stumpf, Eric Busboom), a stakeholder rather than a user. The
League wants code-reading rigour and a course it can sell; students want instant fun. The fun-first
hook and the deliberately limited AI are how the product holds both (`.ua/ua5-stage-2-analysis.md`,
Stakeholders).

## Product Purpose

A browser-based game-development course. Across 24 lessons in 6 modules (about 10–12 hours of
target time), the student reads and modifies one real Phaser 3 platformer, directs an AI assistant
that does the heavy typing, and finishes with one game of their own that they can publish and send
someone a link to.

Success means a child who would freeze at a blank page keeps going, feels the game is *theirs*, and
ends up proud enough to show it off, and comes out understanding how the game works and able to
explain to an AI what they want built. The brief is fun-first — Eric's "Robot Riot" ethic: *have
fun first; then, to keep having fun, you learn to program*. The one thing the course cannot survive
is feeling *worthy*.

It is **Level 1 of a planned two-level track**: this accessible browser course first, then a
heavier in-person course on professional engines.

The five jobs it is built around (`.ua/ua5-stage-2-analysis.md`): get hooked fast · build a real game
without having to invent one · change the game and prove I understood it · check I understood what I
just read · keep the finished game and show it off.

## Positioning

A real codebase, on a locked-down Chromebook, producing something shareable. Block platforms
(Scratch, MakeCode) feel like toys. Unity and Godot won't run on the hardware. Python/PyGame output
is hard to share. Here the student reads real code, makes the design calls, and directs an AI to
carry them out, instead of the code being hidden or typed from scratch. No-code kid engines
(GDevelop, Construct) hide the code; adult AI tools (Cursor, Replit) do too much for a learner; this
is guided, age-appropriate and limited on purpose. Full statement and evidence:
`.ua/ua2-positioning-statement.md`.

Conventions it keeps and breaks on purpose (`.ua/ua5-stage-2-analysis.md`, Inherited conventions):
- **Keeps:** game-engine UX (viewport, code, play, assets, a run button); projects the kid keeps;
  visible XP and progress; an itch.io-style Gallery with play and view-code; instructor-led class.
- **Breaks on purpose:** block coding (it's real JavaScript, with the fast-first-success ethic
  kept); an AI that instantly does everything (limited at challenges, changes visible and
  reviewable); quizzes as separate test screens (they're short and sit in the lesson right after
  the reading); currency that unlocks games (Stars buy *assets*).

## Operating Context

- A single-page studio styled like a game engine: course outline on the left; a
  Learn / Design / Code / Play viewport in the centre; an AI assistant on the right.
- Top-level surfaces: Game Dev (the course), Courses, Store (spend earned Stars on real CC0 art and
  sound), Gallery (published student games), Leaderboards, Docs, Help.
- Progress lives in the student's own browser. Publishing goes through the League's own GitHub org,
  not student accounts.
- Lessons, course structure and the AI's personality are authored as Markdown/YAML by people who
  are not engineers (`app/content/AUTHORING.md`).

## Capabilities and Constraints

- **Browser only, filtered network.** No installs. Every library is vendored; nothing loads from a
  CDN.
- **No bundler and no client build step.** Plain scripts in a fixed order; see `CLAUDE.md`
  "Constraints that are decisions".
- **No per-student third-party accounts and no student data on the server** (COPPA / district
  policy; `docs/child-privacy-brief.md`).
- **Vercel serverless:** no writable disk, no background work, cold starts.
- **Chrome first, then Apple** is the League's platform priority for selling the course. It must work
  for a full cohort at once; per-student VMs are ruled out.
- **The AI is limited on purpose.** Lessons set an AI mode (`full` / `guided` / `off`), and at
  challenges it is deliberately held back so the student has to think. A design that makes the AI
  do more at those points is working against the product.
- **Privacy defaults** (`docs/child-privacy-brief.md`): pseudonymous handles by default; first name
  and last initial only with parental consent; per-game private toggle; teacher takedown; no
  student PII sent to model providers. The League's staff own all consent collection.
- **Terminology in use:** Stars (currency spent in the Store), XP (progress), lessons, modules,
  the Design board (with regions), labs, challenges.
- **Open: the product name.** "Game Dev" is the working name in the app. The final name is pending a
  League branding decision and must not be treated as fixed. It is the one clause blocking a clean
  UA Stage 1 exit.
- **Other open decisions** (`.ua/ua6-specification.md`, Open questions): whether students can
  remix each other's Gallery games; the public marketing home (spec screen 1) is not built yet.

## Brand Commitments

- **The League of Amazing Programmers brand is binding:** the League name, League orange and the
  League marks (`app/public/img/wordmark.png`, `app/public/img/league-logo-white.png`, and the
  "© The League of Amazing Programmers" footer).
- **The engine-studio feel is binding:** the app should keep feeling like a real game engine's
  studio. Design work sharpens that identity; it does not replace it.
- **Sibling voice:** the League's Robot Riot course is where the fun-first ethic and brand voice come
  from (`.ua/ua5-stage-2-analysis.md`, Adjacent products).

## Evidence on Hand

- Two client conversations — Jed Stumpf (July 2026) and Jed + Eric Busboom (2026-07-28) — and a
  prototype the clients approved. Quotes and notes: `.ua/ua1-opportunity-notes.md`,
  `.ua/ua2-positioning-statement.md`.
- The client's lived experience of the failure mode: *"80% don't know what to make; the other 20%
  spend all their time on a sprite… just walk them through making games."*
- One observed reaction at the young end of the range ("can I play? this is fire").
- Secondary research (constructionism, early-ownership retention, project-based learning, making vs
  playing), with counter-evidence, cited in `.ua/ua2-positioning-statement.md` Sources.
- **Absent:** no student or instructor has used the app, and there have been no user interviews
  (the planned instructor and student conversations in `ua1` are still marked NEEDS INTERVIEW).
  Every claim about what a child will feel is a hypothesis. Future work must not invent
  testimonials, usage numbers or classroom results.

## Product Principles

1. **Fun first.** Play and ownership come before instruction; a room that freezes has failed,
   however correct the content.
2. **The game is theirs.** Everything should move the student's own game forward and make that
   visible.
3. **Guided, not blank.** One game built all the way through, never an empty canvas to freeze in
   front of.
4. **The student directs; the AI assists.** Understanding and explaining the code is the skill.
   The AI never quietly takes over the part the student is meant to learn.
5. **Less on screen for a ten-year-old.** The studio's density is its known weakness
   (`docs/app-brief.md` §9.1). Each surface should justify every control it shows.

## Accessibility & Inclusion

- **Required standard: WCAG 2.2 AA.**
- That includes a keyboard path for the Design board, which is currently pointer-only (drag, pan,
  pinch-zoom).
- Readability for ages 10–14 is a product requirement, not a nicety.
