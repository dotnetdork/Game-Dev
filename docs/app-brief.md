# Game Dev — a briefing on the whole application

Written to be handed to another model as source material: enough to understand what this app is,
how it is put together, what it is trying to do to a child, and where it is currently weakest. It is
deliberately not a sales document. The last two sections are the honest ones.

---

## 1. In one paragraph

**Game Dev** is a browser-based game-development course for The League of Amazing Programmers,
aimed at students roughly 10–14 working on school-managed Chromebooks. It is a single-page app
styled as a game engine's studio: a course outline down the left, a Learn / Design / Code / Play
viewport in the middle, an AI assistant on the right. The student reads and modifies one real Phaser 3
platformer across 24 lessons in 6 modules, directs an AI to do some of the heavy typing, earns
Stars and XP, spends Stars on real art and sound in an in-app store, and finishes with one game
they can publish and show people. Everything the student makes lives in their own browser; the
server hosts files and relays AI calls and stores nothing of theirs.

## 2. Who it is for, and the constraints that produced every design decision

The constraints are not incidental — almost every odd-looking choice in this codebase traces back
to one of them.

- **School-managed Chromebooks.** No installs, no Linux container, no Play Store, filtered network.
  So: browser only, and every third-party library is *vendored* into `app/public/vendor/` rather
  than pulled from a CDN, because a CDN is exactly the sort of thing a school filter blocks.
- **No per-student third-party accounts** (COPPA / district policy — see
  `docs/child-privacy-brief.md`). So: no student database, no student code on the server, progress
  in `localStorage`, publishing routed through the League's own GitHub org rather than student
  accounts.
- **Class scale, one instructor, ~10–12 hours.** So: everything must work unattended, and the AI
  has to substitute for a teacher leaning over a shoulder.
- **The client's own experience, quoted in `.ua/ua5-stage-2-analysis.md`:** *"80% don't know what to
  make; the other 20% spend all their time on a sprite… just walk them through making games."*
  This single sentence is the reason the course gives everyone the same starter platformer instead
  of asking them to invent a game, and the reason the Concept Ideation module is *constrained*
  ideation.
- **Teachers must be able to edit content without touching code.** So: lessons are Markdown with
  YAML front-matter, the course structure is a YAML file, and the AI's personality is a set of
  Markdown files. There is a documented authoring language (`app/content/AUTHORING.md`, 539 lines).

The competitive frame it was positioned against: block platforms (Scratch, MakeCode) feel like toys;
Unity/Godot won't run on the hardware; Python/PyGame output is hard to share. The wedge is *a real
codebase, on a Chromebook, that produces something you can send your cousin a link to*.

## 3. The shape of the app

**Server** — `app/server.js`, Express 4, ~1,100 lines. It does four things: serve static files;
serve the authored course out of `content/`; relay AI calls at `POST /api/ai`; and report build info
at `/api/info`. `app/auth.js` handles sign-in (GitHub OAuth, plus a local demo door for development).
That is the entire backend. There is no database.

**Client** — `app/public/`, one `index.html`, one `styles.css` (~2,600 lines), and 19 plain
`<script>` files loaded in a fixed order. **There is no bundler and no build step.** Each file has a
header comment declaring what it owns. Rough sizes: `widgets.js` 2,438 lines (the lesson
interactives), `board.js` ~1,050 (the Design tab board), `ai.js` 820, `project.js` 743, `pages.js`
610, `course.js` 415, `game-runner.js` 400, `files.js` 400.

**Top-level surfaces**, reachable from the nav bar: **Game Dev** (the course itself), **Courses**,
**Store** (spend Stars on assets), **Gallery** (published student games), **Leaderboards**, **Docs**,
**Help**. Inside a lesson there are four tabs: **Learn** (the lesson), **Design** (the student's own design
board — see §6), **Code** (a CodeMirror editor over their project files), **Play** (the running
game). URLs are real: a lesson is `/module/lesson-id`, and Design, Code and Play are top-level
(`/design`, `/code`, `/play`) because none of the three belongs to a particular lesson.

**The game runs in an `iframe srcdoc`**: the app assembles a self-contained HTML document — vendored
Phaser, a console shim that pipes errors back out, an injector for whatever assets the student owns,
then the student's own scripts — and hands it to the iframe. (See §9: the sandbox attribute on that
iframe is currently an unresolved trade-off.)

## 4. Content is data, not code

- `app/content/course.yaml` — 6 modules, 24 lessons, star values. Heavily commented with the
  *reasoning* for the order, not just the order.
- `app/content/lessons/*.md` — one file per lesson. Prose plus fenced interactive blocks.
- `app/content/questions.yaml` (1,144 lines) — the conversation openers each AI agent offers, keyed
  per lesson, per lab, per module.
- `app/content/vocabulary.yaml` — a prerequisite graph: 19 prose terms and 7 JS constructs, each
  mapped to the lesson that introduces it. A checker walks the course in order and reports any
  lesson leaning on a word a later lesson teaches. *Reordering the course means editing this file,
  and that is the point.*
- `app/content/glossary.yaml` — student-facing definitions.

**The five interactive fence types**, which are the whole authoring language:

| Fence | What it does |
|---|---|
| ` ```run ` | A runnable cell, with an optional `@predict` (guess before you run — PRIMM's Predict stage) and `@demo` for live pictures/sliders |
| ` ```quiz ` | Multiple choice, checked locally, every option needs its own feedback line and the whole thing needs an `explain:` |
| ` ```challenge ` | An embedded mini-game the student edits until `win()` fires; winning completes the lesson |
| ` ```yourturn ` | A task against the student's **real project**, with a deterministic `check:` rule (`config_changed`, `function_added`, `called_in_update`, `contains`, `published`, …) |

## 5. The AI

`POST /api/ai` is a **relay**, not a chatbot. It routes by *agent*, and each agent is a Markdown file
in `app/ai/agents/` — `tutor`, `coder`, `quiz`, `grader`, `lab-tutor`, `design-coach` —
composed with reusable skill files in `app/ai/skills/` (`kid-communication.md`,
`phaser-rules.md`, `explain-a-line.md`, `guided-mode.md`). These hot-reload, so tuning the AI's
behaviour means editing prose. Each agent gets its own `provider:model` from `.env`, so the app runs
against local Ollama, OpenRouter, or Anthropic interchangeably. **Keys never reach the browser.**

The critical pattern, repeated for every agent: **a deterministic validator sits between the model
and the child.** `app/ai/quiz-check.js` and `grade-check.js`. Their shared contract is
*reject, never repair* — a malformed reply is treated as an ordinary event on the happy path, the
validator returns `null` for "could not vouch for this", and the caller turns that into "nothing
happened" rather than into an error message. The coder agent returns JSON *ops* rather than code;
the client applies them, parse-checks the result, and reverts on failure.

There is also an MCP server (`app/ai/mcp-server.js`) exposing the course to external tools:
`get_lesson`, `search_phaser_docs`, `search_store`, `read_file`, `list_owned_assets`.

## 6. The Design tab — where the student's own game lives

The four tabs inside a lesson are **Learn · Design · Code · Play**. Design is the student's own
design board, open on every lesson from the first to the last, and it is the app's answer to "work
on your own game".

- **A pannable, zoomable canvas** with dotted-line **regions** — "MY GAME", "NOT BUILDING — NEXT
  TIME", "IDEAS, UNSORTED". Regions auto-resize to fit what is dropped in them.
- **Sticky notes** — one fixed sticky per heading of the one-sheet, plus as many loose notes as the
  student adds. Draggable, editable, pinnable, resizable, deletable. Notes can be linked.
- **The board is the editor for a real file.** It reads and writes `design.md` in the student's own
  project. Dragging a sticky from "My game" into "Not building" rewrites that file — cutting scope is
  something the student *does* rather than something a lesson describes.
- **Nothing else is on the tab.** No outline, no console, no Inspector, no second chat. The shell's
  AI panel serves it like every other tab, with **Build disabled** (it edits game files and there are
  none here) and the **Tutor** answering as the `design-coach` agent, which is given the board's
  boxes, its loose notes and the lesson the student is on. The coach asks; the student writes.
- Lessons reach it with an ordinary `yourturn` — "open the Design tab and…" — checked with
  `contains: {file: design.md, …}` like any other step.

**This replaced a CHECKPOINT system, removed 2026-09-09, and the history matters when reading older
docs in this repo.** Every module used to end in a checkpoint: a gated lesson that opened this same
board full-screen with objectives, a progress rail, a Finish button, a badge and a coach conducting
an interview that filled the boxes in for the student. Module Stars waited behind it. The board was
the good half and the gate was the bad half — six walls, each arriving as a different kind of thing
from every lesson around it, none of them somewhere a student could go back to. The course went from
30 lessons to 24; the six checkpoint files are in `content/_archive-v1/` with their board specs.

Two deliberate consequences worth knowing when critiquing:

- **The coach no longer writes on the board.** It could, and did — a trailing `SLOT:` line in its
  reply wrote straight into `design.md`. That went with the checkpoints: a board an assistant fills
  in is not the student's design.
- **Design, Code and Play have top-level addresses** (`/design`, `/code`, `/play`) rather than being
  nested under a lesson, because none of the three changes when you turn the page. Only a lesson and
  its lab are lesson-scoped.

## 7. State, and how progress is stored

Everything is in `localStorage`, versioned, with real migrations:

- **The project** (`SCHEMA.project: 3`) — `game.js`, `main.js`, `design.md`, any extra scripts.
- **Progress** (`SCHEMA.progress: 2`) — XP, Stars (400 to start; earned per lesson, practice step
  and lab, plus a module bonus), which lessons are done, which
  modules have paid out, unlocked assets, published games, per-activity answers, lab drafts,
  practice-rule results, badges, chat threads.

Two properties the codebase treats as sacred: **a save it cannot read is quarantined, never
overwritten**, and **a save from a newer build than the running one is left alone, never
downgraded**. Progress used to be keyed by a lesson's *position*; it was re-keyed to lesson slugs
behind a frozen migration table specifically so the course could be reordered without moving every
child's ticks.

## 8. How it is verified

`npm test` runs **14 deterministic checkers** in `app/tools/`, and this is one of the more
distinctive things about the repo — they check the *content* as strictly as the code:

`check-encoding` (no NUL bytes — one will make ripgrep skip a file silently) · `check-html` ·
`check-state` (every migration, plus idempotency) · `subset-icons --check` (an icon used but not in
the font subset renders as a blank box) · `check-quiz` · `check-grade` · `check-lessons` (pacing —
no two activity fences adjacent, first activity inside the first 25% of blocks; quiz feedback arity;
lesson ids) · `check-challenges` · `check-questions` (minimum pool sizes per lesson) ·
`check-assets` · `check-vocab` (the prerequisite graph) · `check-mcp` · `check-gamelog` ·
`check-boot` (boots the real server with jsdom and asserts the app actually renders).

The house convention: land a new check as a *report*, then promote it to fatal once the list it
prints has emptied.

Assets: 3,256 Kenney CC0 sprites and sounds across 19 packs, credited in
`app/public/assets/CREDITS.txt`, sold in the Store as ~104 sets of pictures plus loose sounds (a
picture that belongs to a pack is never sold alone; a sound always is; nine starter sprites are
free), and auto-preloaded by key into the game.

## 9. Where it is actually weak — read this before critiquing

The client's own summary, September 2026: *"it feels kind of like a jumbled prototype of an idea.
It's a little cluttered, the checkpoints are a little strange — I enjoy the direction, but I'm not
sure they are as useful as I intended."* That judgement was taken as a finding rather than a mood,
and the checkpoints were removed because of it. What follows is what is still true.

1. **Density.** The studio shell (outline + viewport + AI panel + console dock + file tree + Star/XP
   footer + nav bar) puts a great many controls on screen at once for a ten-year-old. The Design tab
   answers part of this by stripping itself to the board alone, which raises the obvious question
   about the other three.
2. **The Design tab is the newest thing here and the least validated.** The gate is gone, but the
   open questions the checkpoints raised are not: does a twelve-year-old understand what the board
   is *for* on arrival? Is filling it in felt as progress on their game, or as a form? Does anything
   connect the sticky they wrote in week one to the code they write in week eight — now that nothing
   forces the trip? Is a whiteboard the right metaphor for someone who has never used one?
3. **Two visual languages.** Lessons are a reading layout; the board is an infinite canvas. Nothing
   teaches the transition — and the board is now one tab away at all times rather than arriving six
   times with an explanation attached.
4. **The one-sheet's first draft is uninformed by design** — ideation is module 2, before Core
   Mechanics teaches the vocabulary. The mitigation is that the board is always open and meant to be
   revised. Nothing now *prompts* that revision, which is the trade the removal made: no gate, and
   no reminder either.
5. **Assets and juice sit late.** The lesson-2 Store purchase gives every student a character of
   their own in the first forty minutes, but sprites, sound and juice are still module 6. The
   counter-argument on record is that `ship-it` must be last because publishing is the payoff.
6. **Two duplicated themes.** `physics-and-collision` (module 1) vs `input-movement-collision`
   (module 4) both teach overlap/collide; `from-project-to-playable` (module 1) vs `ship-it` (last)
   both teach delivery, bookending the course with two similar badges.
7. **An unresolved engineering trade-off**, recorded in `app/public/js/dev.js`: the game iframe is
   sandboxed with `allow-scripts`, which produces an opaque origin, and an opaque-origin document
   cannot make *any* subresource request back to the app — so vendored Phaser never loads. Measured
   and confirmed. The choice today is between a sandboxed frame that cannot run and an unsandboxed
   one that can; the real fix is serving the game frame from its own origin, which is not built.
8. **No student or instructor has ever used it.** Evidence to date is documented research plus two
   client conversations plus an approved prototype. Zero user interviews. Every claim in this
   document about what a child will feel is a hypothesis.
9. **Course length.** 24 lessons is roughly 12–15 hours against the ~10–12 in the spec.
10. **Accessibility.** A WCAG audit is pending. The board in particular is pointer-driven — drag,
    pan, pinch-zoom — with no keyboard path.

## 10. Two lenses a critic should be asked to use

**As a design/interface critic (the "impeccable" pass).** The repo already carries `.impeccable/`
config from previous critique passes on the leaderboards and the lesson reading layout, so this is
an established practice here. The productive targets are the ones in §9.1–9.3: visual density,
whether the two interface languages can be reconciled, whether the board's toolbar and zoom are
explained by anything, and whether a first-time ten-year-old can tell what to press. The app's own aesthetic is a dark engine-studio look with League orange;
critique should sharpen that, not replace it.

**As a 10–14 year old.** The questions worth answering in that voice: Would I keep going after
lesson 3? Is the game mine yet, and when does it first feel that way? Do I understand what the
Design tab is for the first time I press it? Is talking to the AI fun, or is it a teacher with extra steps?
Would I show this to a friend? What is boring? What is confusing? What did I skip? The one thing
this course cannot survive is being *worthy* — the client's whole brief is fun-first, and the
failure mode the client has already lived through is a room of kids who freeze on a blank page or
disappear into a sprite for six weeks.
