# Product

<!-- impeccable:product-schema 1 -->

Written by `/impeccable init` on 2026-09-24. This is the product record Impeccable reads before any
design work. It records product truth only: no palettes, type or components. The longer accounts it
draws on are linked rather than restated: `docs/app-brief.md`, `.ua/ua2-positioning-statement.md`,
`CLAUDE.md`.

## Platform

web

## Users

**Primary: students aged ~10–14** at The League of Amazing Programmers, working on
**school-managed Chromebooks** behind filtered networks, in cohorts of about 20 with one instructor.
Design work optimizes for the child at the keyboard. Most of them do not know what game to make, and
the rest can lose weeks to a single sprite (`docs/app-brief.md` §2).

Secondary: League instructors (the course has to run unattended at class scale, with the AI standing
in for a teacher at their shoulder) and League leadership and parents, who choose the course.
Neither is the audience the interface is shaped around.

## Product Purpose

A browser-based game-development course. Across 24 lessons in 6 modules (about 10–12 hours of
target time), the student reads and modifies one real Phaser 3 platformer, directs an AI assistant
that does the heavy typing, and finishes with one game of their own that they can publish and send
someone a link to.

Success means a child who would freeze at a blank page keeps going, feels the game is *theirs*, and
ends up proud enough to show it off. The brief is fun-first: the one thing the course cannot survive
is feeling *worthy*.

## Positioning

A real codebase, on a locked-down Chromebook, producing something shareable. Block platforms
(Scratch, MakeCode) feel like toys. Unity and Godot won't run on the hardware. Python/PyGame output
is hard to share. Here the student reads real code, makes the design calls, and directs an AI to
carry them out, instead of the code being hidden or typed from scratch. Full statement and evidence:
`.ua/ua2-positioning-statement.md`.

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
- **Terminology in use:** Stars (currency spent in the Store), XP (progress), lessons, modules,
  the Design board (with regions), labs, challenges.
- **Open: the product name.** "Game Dev" is the working name in the app. The final name is pending a
  League branding decision and must not be treated as fixed.

## Brand Commitments

- **The League of Amazing Programmers brand is binding:** the League name, League orange and the
  League marks (`app/public/img/wordmark.png`, `app/public/img/league-logo-white.png`, and the
  "© The League of Amazing Programmers" footer).
- **The engine-studio feel is binding:** the app should keep feeling like a real game engine's
  studio. Design work sharpens that identity; it does not replace it.

## Evidence on Hand

- Two client conversations (July 2026; 2026-07-28) and a prototype the clients approved.
- One observed reaction at the young end of the range ("can I play? this is fire").
- Secondary research on middle-school motivation, cited in `.ua/`.
- **Absent:** no student or instructor has used the app, and there have been no user interviews.
  Every claim about what a child will feel is a hypothesis. Future work must not invent
  testimonials, usage numbers or classroom results.

## Product Principles

1. **Fun first.** Play and ownership come before instruction; a room that freezes has failed,
   however correct the content.
2. **The game is theirs.** Everything should move the student's own game forward and make that
   visible.
3. **Real, not a toy.** Real code, a real engine, real output. The honesty of the tools is the
   selling point.
4. **Runs where they are.** A locked-down Chromebook on a school network, at class scale, unattended.
5. **Less on screen for a ten-year-old.** The studio's density is its known weakness
   (`docs/app-brief.md` §9.1). Each surface should justify every control it shows.

## Accessibility & Inclusion

- **Required standard: WCAG 2.2 AA.**
- That includes a keyboard path for the Design board, which is currently pointer-only (drag, pan,
  pinch-zoom).
- Readability for ages 10–14 is a product requirement, not a nicety.
