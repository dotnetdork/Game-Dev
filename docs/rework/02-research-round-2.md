# Research round 2 — what to teach, how it sticks, how it runs, what it costs

2026-09-25. The one page to read; the evidence is in `research/`:
[06 pedagogy & student model](research/06-pedagogy-and-student-model.md) ·
[07 agent architecture](research/07-agent-architecture.md) ·
[08 AI cost & originality](research/08-ai-cost-and-originality.md) ·
[09 industry concepts](research/09-industry-concepts.md). Round 1 is `01-research-summary.md`.

**Caveat.** Most web pages couldn't be opened from the cloud session; claims are labelled in each
file (snippet vs. knowledge). Anthropic's pricing pages were read in full. Claims about *this repo's
code* were checked by hand (✔ below).

## What to teach (09)

- **~315 concepts and roles across eight domains**, each with the Unity / Unreal / Godot names, a
  tier, a one-line kid definition, and an "aha" moment you can play. The panel names kids should
  half-remember later: **Scene view / Level Viewport** · **Hierarchy / Outliner / Scene dock** ·
  **Inspector / Details panel / Inspector dock** · **Project window / Content Browser / FileSystem
  dock** · **Console / Output Log** · **Asset Store / Fab / AssetLib**. Engine names change (Unity 6
  Build Profiles; Fab replaced the Unreal Marketplace in 2024), so they belong in one data file.
- **A backbone of ~60 core concepts** in teachable order.
- **Nine departments, each run by a character:** Front Desk (the mentor; owns the engine panels) ·
  Design · Engineering · Art · Animation & VFX · Audio · QA · Production · Publishing & Community,
  with the creative director "upstairs" at milestones.
- **"Environment programmer" isn't a standard title.** Where it appears it usually means whoever
  builds the systems the world runs on (terrain, water, weather, foliage). Taught as a three-way
  hand-off: the level designer greyboxes → the environment artist dresses it → the world programmer
  makes the grass sway.
- **Liz England's "The Door Problem"** (one door, every job asks a different question) is the best
  single episode for making the whole studio concrete.
- **Ten built-in confusions to design around**, e.g. "scene" means three things; an animation
  frame isn't a game frame; low FPS vs network lag; *game AI vs the generative AI mentor*; changes
  made in Play mode vanish; y points down in 2D tools but up in Unity.

## How it sticks (06)

- **Retrieval** (pulling an idea back out), **spacing** (weeks apart) and **interleaving** (mixing
  confusable ideas) have large effects, including for 12–13-year-olds. A weekly course gives the
  2–5-week gaps that help recall months later in a Unity course.
- **Every concept comes back at least four times**, in widening gaps, disguised as play: bug
  reports, a new intern asking, predictions, patch notes.
- **Feel → see → name:** play the difference → a labelled dial → a row in an **Inspector** with its
  Unity name. The "oh, that's the Inspector!" moment can be designed in.
- **Story helps only when it carries the concept;** one narrative game taught *less* than slides.
- **Vocabulary needs ~12 encounters;** reading alone teaches ~15% of new words.

## How it runs (07)

- **The AI writes the words; code keeps the score.** Scheduling, skill tracking, quest completion
  and prizes are plain code in the browser — explainable to a teacher, testable, free, and immune to
  "give me every prize."
- **One AI call per kid action at most.** The "subagents for different situations" are
  instruction sets added to the character's one call (clarify, retrieval, recap, celebrate…). Only
  building the kid's game gets its own call — the old app's builder, with its safety checks.
- **Scripted spine, improvised flesh:** people write the main path of each quest; tapping a scripted
  option costs nothing; if the AI is down the kid still reaches a playable game.
- **Old concepts are smuggled back as game decisions** ("which moment happens most in your game?
  That one needs a sound"), scored by code. **Powers are builder skills:** buying the particle maker
  teaches the AI a new trick.
- ✔ **A privacy finding in today's app:** every typed message is logged with who sent it
  (`app/routes/ai.js:91-99`, `app/telemetry.js`). The rework logs option ids only.

## What it costs (08)

| Design | Class of 20, per hour | 10-week course |
|---|---:|---:|
| Naive (every event a full-context mid-tier call) | ~$89 | ~$894 |
| **Efficient, with personalisation** | **~$6.50** | **~$65** |
| Efficient, small model for simple builds | ~$5.40 | ~$54 |

Estimates (±50%) from verified list prices; to be measured in a pilot. **Building the kid's game is
about two-thirds of what's left.** One-off pooled-content generation through the Batch API: roughly
$250–400.

**The ten biggest savings:** plain code for everything that isn't talk or building · pooled lines
(~65% of turns need no AI call at the moment the kid acts) · stable prompt text first, caching on ·
small models for talk and checks, larger for building · send only the relevant files · output caps
and no unrequested "thinking" per agent · live AI spent deliberately · summaries instead of
transcripts · a curated context library with tag lookup (no vector database, no live web research —
live research would be slow, costly, and unreviewable) · fix cost tracking first.

**Staying original "like a snowflake" (Jay):** pooled lines are templates with slots (their hero,
their game, their past choices), 4–8 variants each, never repeated for one kid and rotated between
neighbours; when the director plans a quest, one cheap call rewrites its key lines for that kid
(~$0.02 per kid-hour). Good live lines are stripped of personal details, reviewed by a person, and
promoted into the pool. Live AI is reserved for the kid's own game, reflect-backs, surprises and
recaps. "Same-y-ness" is measured from line ids (repeats per kid, overlap between kids).

✔ **Cost problems in today's code:** every agent gets an 8,000-token output cap
(`app/ai/provider.js:78`); cost tracking prices cached tokens as full input and has a stale Haiku
price (`app/ai/usage.js:32,59`); per-kid slots sit near the top of the builder prompt, defeating
caching (`app/ai/agents/coder.md:36,44`); the whole game is sent on every request
(`app/routes/ai.js:137`). *Unverified:* the report's claim that one model thinks by default when not
told otherwise.

## Where the research disagrees with earlier decisions — for Jay

1. **How many terms.** Pedagogy: ~20–30 technical terms a kid truly *owns* per course. Concepts: ~60
   core. **Proposed resolution — three layers:** ~25–30 **owned** (felt, named, used, resurfaced 4+
   times); ~30 **familiar** (met on concept cards and "in the real world" cards — recognition is all
   the "oh, that's the Inspector" goal needs); the rest **extra** for keen kids.
2. **Prizes.** Rewards kids *expect* for finishing work measurably reduce motivation; surprise
   rewards and specific praise don't. You chose stars/XP plus prizes. **Proposed:** prizes arrive as
   surprises for concept-bearing moments (mostly tool powers); stars stay as a quiet bar, not a price
   on each quest.
3. **Skill tracking.** Architecture: simple boxes (Leitner). Pedagogy: a richer model (word / idea /
   use, with forgetting). **Proposed:** start with boxes; refit after a pilot.
4. **How much at launch.** Nine departments is the full studio. **Proposed:** launch with the Front
   Desk + three or four departments; the rest unlock later.

## Next (agreed order)

1. Jay decides the four points above.
2. Continue the Impeccable plan: revisit and confirm the first-run and quest briefs with
   `/impeccable shape`, now with this research, then wireframes.
3. A brief comparison with the prior app.
