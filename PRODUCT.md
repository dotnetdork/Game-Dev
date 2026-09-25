# Product

<!-- impeccable:product-schema 1 -->

Written by `/impeccable init` on 2026-09-24; **rewritten 2026-09-25 for the rework.** This is the
product record Impeccable reads before any design work. It records product truth only: no palettes,
type or components. The longer accounts are linked rather than restated.

**Where the decisions live.** The rework's direction, in Jay's words: `docs/rework/00-direction.md`.
Every feature and its status: `docs/rework/features.md`. How the course runs:
`docs/rework/course-engine.md`. Research: `docs/rework/01-research-summary.md`,
`docs/rework/02-research-round-2.md`, `docs/rework/research/`. Surface briefs:
`docs/rework/briefs/`. The original planning and research (UA Framework, owned by Jay) are in
`.ua/`; the current app — now a reference, not the starting point — is described in
`docs/app-brief.md`. Working rules: `CLAUDE.md`.

## Platform

web

## Users

**Primary: kids aged 10–13 who are new to IT, CS, and computers in general**, at The League of
Amazing Programmers, on **school-managed Chromebooks** (typically 1366×768, trackpads) behind
filtered networks, in classes of about 20 with one instructor. Assume nothing: not files, not tabs,
not keyboard shortcuts, not right-click, not fast typing. Short attention; they will not read walls
of text; motivated by making something that's theirs and showing it.

Secondary: League instructors (the course must run at class scale with the AI as the teacher at
their shoulder, and they need to see who is stuck) and parents (a safe experience, a real skill, a
game to show). The client is the League (Jed Stumpf, Eric Busboom).

## Product Purpose

**A game-concepts course that is itself a game.** The kid is the new developer at a game studio.
Studio characters — each a real game-industry role — give quests; each quest teaches one game
concept by having the kid feel it, name it, and build it into **their own game** by directing the
AI. **C# is met as the programmer's job:** from mid-course kids see the real C# behind a change and
tweak values in it (a Unity-flavoured subset); writing code is optional, for keen kids.

Success: kids have so much fun they don't notice they're learning, and the concepts stick — so that
later, in a Unity, Godot or Unreal course or on the way to a games career, they think "oh, that's
the Inspector", "I know what a frame is", "I know what VFX means", "I know what a QA tester does".
The goal is to spark the flame in the next generation of game developers — programmers, artists,
animators, designers, sound designers and the rest.

## Positioning

**The AI is the course.** Not a chatbot beside lessons: an AI mentor, studio characters and a
director that plans ahead form one web that teaches, adapts to each kid, and builds with them — on a
locked-down school Chromebook, with no installs. Block tools hide the craft; pro engines don't run
here; adult AI tools do everything for you. This teaches the real vocabulary and roles of the game
industry through play, and every kid's path and game is their own.

## Operating Context

- **The interface mimics a real game engine** — viewport, Play/Stop, a parts list (the engine's
  Hierarchy), an Inspector-style view of settings — so the engine itself becomes familiar. In the
  story it is the kid's desk at the studio.
- **Conversation is Skyrim-style:** 3–4 dialogue options every time, plus "say something else."
- **Choices branch and rejoin:** order, flavour, examples and characters differ; every kid reaches
  the core concepts.
- **The first run is the studio's "first day"** (~5 minutes): the engine builds itself around the
  kid, and it ends with them playing a game they invented (`docs/rework/briefs/first-run.md`).
- **At launch:** the Front Desk (the mentor) plus Design, Engineering, Art (+ Animation/VFX) and
  Audio; QA, Production and Publishing unlock later.
- Classes meet about weekly; a course runs roughly ten sessions.

## Capabilities and Constraints

- **Browser only, filtered network, no installs;** vendored libraries; Vercel serverless (no
  background work, 60 s ceiling); no bundler (`CLAUDE.md`).
- **The AI writes the words; code keeps the score.** Scheduling, skill tracking, quest completion
  and prizes are deterministic code, never the model's say-so. People write the concept web and the
  quest outlines; the AI improvises inside them (`docs/rework/course-engine.md`).
- **The AI adapts** to what each kid shows — pace, words, examples, how much it builds, try-first vs
  watch-first — not to "learning style" labels.
- **Concepts come back** at least four times across sessions, disguised as play (spaced retrieval).
- **Three layers of terms:** ~25–30 a kid owns; ~30 familiar; the rest extra.
- **Prizes are surprises** for concept-bearing moments (mostly new tool powers, studio unlocks,
  desk/avatar cosmetics); a quiet stars bar, never a price on a quest.
- **Privacy:** no real names, birthdays, schools, locations, photos, voice or stored chat
  transcripts; a small learner card the kid and teacher can see and reset; the model sees only the
  fields a request needs (COPPA; `docs/child-privacy-brief.md`).
- **Cost:** efficient by design — pooled, personalised content and one AI call per action at most;
  target on the order of ~$6.50 per class-hour (`docs/rework/research/08-ai-cost-and-originality.md`).
- **If the AI is down,** the written quest paths still get a kid to a playable game.
- **Open:** the product name ("Game Dev" is a working name, pending a League branding decision); the
  characters' names and looks; the store's single art style; the teacher view.

## Brand Commitments

- **The League of Amazing Programmers brand is binding:** the League name, League orange, and the
  League marks (`app/public/img/wordmark.png`, `app/public/img/league-logo-white.png`).
- **It should feel like a real game engine** (Jay) — a studio workstation, not a toy and not a
  worksheet. And it should feel **made for 10–13-year-olds** who are new to computers.
- **The mentor is openly an AI, and proud of it.**

## Evidence on Hand

- **The first live student test (September 2026):** kids were bored, didn't know where things were,
  couldn't tell what to do, found the UI overwhelming and the lessons too wordy, and felt the course
  and the building were disconnected (`docs/rework/00-direction.md`). The first evidence from real
  users.
- An Impeccable critique of the old app (20/40) that explains each finding
  (`docs/rework/research/05-critique-current-app.md`).
- Two client conversations and an approved prototype (`.ua/`); research on kid UX, AI and learning
  (`docs/rework/research/`).
- **Absent:** no test of the rework yet. Claims about what kids will feel are hypotheses; never
  invent testimonials, numbers or classroom results.

## Product Principles

1. **The course is a game; learning is how you win it.** The concept is the lever that changes the
   kid's game.
2. **The game is theirs.** Their own game is always at the centre, and every quest changes it.
3. **Feel it, see it, name it.** Play the difference, see the dial, then learn the real engine word.
4. **Never a wall of text.** One sentence at a time; one obvious next step.
5. **The kid directs; the AI builds.** Choices first, then the AI does the heavy lifting, and says
   what it changed.

## Accessibility & Inclusion

- **Required standard: WCAG 2.2 AA.**
- Nothing essential needs dragging, right-click, resizing or keyboard shortcuts; large targets;
  dialogue options always available so typing is never required.
- Readability for ages 10–13 (about a 6th-grade reading level or lower) is a product requirement.
