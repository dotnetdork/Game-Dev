# Game Dev: architecture review and the build plan

> Written while the course was called **CodeQuest**; renamed back to **Game Dev** on
> 21 Aug 2026. Same product, same plan — only the name changed.

**Date:** 17 August 2026
**Decisions locked** (Jay, this session):

1. **Per-module teaching game, *plus* the student's own game running the whole course.**
2. **Work lives on the LEAGUE code server**, behind a login — code-server account normally, personal GitHub occasionally.
3. **Students see real token cost**, capped per account by their allotment.
4. **Sync lives in the bottom status bar.**
5. **1.0.0 is a shipped product, not an MVP.** Nothing reaches a child, a classroom, or the League
   server before then. Everything below is pre-1.0.0 work measured against the bar in Part 0.

---

## Part 0 — What 1.0.0 has to mean

This is a product that (a) children under 13 will use, (b) runs on school infrastructure, (c) holds
work a child will care about losing, and (d) sends that child's code to a third-party AI. Each of
those four carries obligations an internal tool doesn't have. The list below is the release gate:
1.0.0 ships when every line is true, and not before.

### Blockers — things that are wrong today and get worse with accounts

**B1. The game iframe is same-origin with the app.** `#gameFrame` has no `sandbox` attribute and is
driven by `srcdoc`, so it inherits this page's origin. Verified in a live probe: code inside it can
read and write the parent's `localStorage`, read `document.cookie`, and **call app functions
directly** — `parent.completeLesson` and `parent.saveState` both resolve. Today the blast radius is
the student's own browser. After Stage 2 it is session access and a one-line course skip, in a
document whose contents are written partly by an AI and partly by a 13-year-old pasting things off
the internet. Fix: `sandbox="allow-scripts"` (no `allow-same-origin`), and move the console capture
and audio control fully onto `postMessage`, which is already how the audio path works.

**B2. Saved state has no schema version.** `leagueProject` and `leagueProgress` are written as bare
JSON (`project.js:34, 227`). `loadProject` guesses at shape; `loadState` does `Object.assign` over
defaults. Any change to either shape silently drops or corrupts existing work, and the artifact
here is a game a child built. Fix before anything writes to a server: a `v` field, a migration
chain, and a refusal-to-load path that preserves the old blob rather than overwriting it.

**B3. Rate limiting keys on a client-supplied id.** `server.js:495` limits on `studentId`, which
`ai.js` generates in the browser. Any student can mint a new one and reset their own limit, and
after Stage 7 that is the token budget being bypassed. Must key on the server session.

**B4. No security headers at all.** No CSP, no `X-Content-Type-Options`, no frame options. The app
renders AI output and Markdown into the DOM; DOMPurify is the only line of defence and it should
not be the only one.

**B5. No automated tests and no CI.** Two hand-run harnesses (`check-challenges`, `check-mcp`,
plus the `check-html` added this session). No `test` script, no `.github/workflows`. A product
maintained by rotating interns needs the tests to run themselves.

### The 1.0.0 checklist

**Correctness**
- [ ] `npm test` runs everything; CI runs it on every push
- [ ] Unit coverage on the ops protocol, the four validators, state migrations, and XP/unlock rules
- [ ] A boot smoke test that loads the app and asserts it reaches a usable lesson
- [ ] All 5 teaching games covered both ways by the challenge harness
- [ ] Every failure path has a defined behaviour: AI down, server down, network drop mid-sync,
      storage full, corrupt saved state, asset 404

**Data safety**
- [ ] Versioned state schema with migrations (B2)
- [ ] Server-side backup of student work, and a tested restore
- [ ] Sync conflict resolution a 12-year-old can act on
- [ ] Nothing can destroy a student's game without a confirm and a recoverable copy

**Security**
- [ ] Game iframe sandboxed (B1)
- [ ] Rate limit and token budget keyed to the session (B3)
- [ ] CSP and the standard headers (B4)
- [ ] Input validation on every endpoint; no student-supplied value reaching a file path
- [ ] Secrets never in the repo, never in the browser; documented rotation
- [ ] Dependency audit clean

**Privacy** *(the League's policy call — the app has to make the answers implementable)*
- [ ] Written answer to: what is stored, for how long, who can see it, what leaves the building
- [ ] COPPA position for under-13s and FERPA position for school records — decided by the League,
      not by me, but decided *before* launch
- [ ] Data export and data deletion actually implemented, per account
- [ ] The AI profile stores behaviour, never transcripts or free text
- [ ] A plain-English page a parent could read

**Accessibility**
- [ ] Full WCAG 2.2 AA pass, not the partial one done so far
- [ ] Keyboard-only path through every task in the course
- [ ] Screen-reader pass on the lesson surface and the editor
- [ ] A published accessibility statement (a school product will be asked for one)

**Operations**
- [ ] Health check, structured logging, error reporting
- [ ] Documented deploy and a tested rollback
- [ ] A teacher can reset a class and recover a student's work
- [ ] Load-tested at one class (25 concurrent) and one school

**Content**
- [ ] All 22 lessons authored to one quality bar and reviewed by someone who teaches this age
- [ ] **Image rights cleared** — see the note below
- [ ] Asset licences documented (Kenney is CC0; everything else needs a line)
- [ ] Reading level checked against the 10–14 target

**Handoff** *(Jay is an intern; someone else will own this)*
- [ ] Teacher guide
- [ ] Operator runbook
- [ ] Architecture doc that matches the code
- [ ] The authoring guides kept current

### One content risk worth raising early

Module 2 is built on game history, and history lessons want screenshots — Asteroids, Donkey Kong,
Mario, Sonic, Zelda, RuneScape, Minecraft, Fortnite — plus the engine module wants shots of Unity,
Unreal and Godot. **All of that is copyrighted.** A teacher putting screenshots in a slide deck is
a very different legal position from an organisation shipping a product. Educational fair use is
arguable, not automatic, and it is not a call for me or for Jay to make alone.

Cheap ways through, in order of preference: original diagrams and recreations that show the *system*
rather than the screen (which is what the lesson is actually about, and is better teaching);
press-kit art, which most engine vendors provide under clear terms; Wikipedia/Wikimedia images with
checkable licences; or a cleared licence. Worth deciding in Module 2's authoring, not at release.

### Version milestones

| Version | Gate |
|---|---|
| **0.2.0** | Blockers B1–B5 closed. Foundations landed (Stage 1). |
| **0.3.0** | Login, server persistence, sync working end to end (Stages 2–3). |
| **0.4.0** | Two-game structure and the rebuilt panels (Stage 4). |
| **0.5.0** | All 22 lessons and 5 teaching games authored (Stage 5). |
| **0.8.0** | Agentic AI, budgets, unlocks (Stages 6–7). Feature complete. |
| **0.9.x** | Hardening only: the checklist above, plus a supervised pilot with real students. |
| **1.0.0** | Every box ticked. First class of students who aren't a pilot. |

---

## Part 1 — What's actually there now

### The shape of it

| Layer | Files | Size | What it does |
|---|---|---|---|
| Server | `app/server.js` | 641 lines, one file | Static hosting, `/api/info`, `/api/ai`, `/api/usage`. Also: config, model routing, three provider adapters, the ops protocol, four validators, the tool-calling loop, rate limiting |
| AI | `app/ai/` | 6 files | 4 agents + 4 skills as Markdown, a loader, 5 tools, the usage meter, the MCP server |
| Content | `app/content/` | 1 YAML + 47 Markdown | The whole course, authored as files |
| Client | `app/public/js/` | 12 files, ~3,000 lines | No build step, no module system |

### What works and should survive any rewrite

- **Content is authored files, not code.** `course.yaml` + Markdown with front-matter. A teacher can edit a lesson without a developer. This is the best decision in the codebase.
- **AI behaviour is also authored files.** The same idea applied to prompts. Four agent files and four skill files in plain English.
- **No build step.** Anyone can open the folder and change something. For a school project maintained by rotating interns, this is worth more than it costs.
- **Everything vendored locally.** Correct call for filtered school networks. (The *granularity* was wrong — see the layout plan — but the principle holds.)
- **The AI is not trusted, it is checked.** Ops protocol, four deterministic validators, parse-check and revert. This is the right trust boundary and most educational AI tools don't have it.
- **Real test harnesses.** `check-challenges.js` asserts all 10 challenges are both solvable *and* not already solved. `check-mcp.js` runs 14 checks. These assert behaviour, not shape.

### The five real structural problems

**1. There is no module system, so there is no encapsulation.**
Twelve files, every symbol global, load order load-bearing (`project.js` before `course.js`, `ui.js` dead last, `editor.js` builds CodeMirror at parse time). Adding anything means understanding the whole graph. This is the single biggest thing standing between the app as it is and the app being agentic.

**2. Nothing owns state.**
`state`, `project`, `course`, `flat`, `curIdx`, `aiMode`, `currentAIMode`, `reviewing`, `lessonPlan` are module-level variables mutated from anywhere. There is no event bus, so `completeLesson()` has to *know* to call `renderOutline()` and `renderFooter()`. That coupling is what caused the earlier bug where completing a lesson re-rendered it and destroyed the answers that had just triggered the completion.

**3. The app has two unrelated ideas of "code you edit", and never says so.**
The student's project (Code tab, one `starter-code.js` shared by all 47 lessons) and the in-lesson challenge widget (`widgets.js`, which spins up a *separate* iframe with *separate* code). A student fixes a challenge and their actual game is untouched. **This is the confusion, and it is not the panels' fault.** Decision 1 turns this from an accident into a deliberate, labelled distinction.

**4. Nothing persists past the browser.**
All of it is `localStorage`. `studentId` is generated client-side, so it isn't identity — it's a guess. This blocks GitHub sync, teacher visibility, per-student token budgets, cross-device, and any form of AI memory. Decision 2 removes this block.

**5. The AI is excellent request/response and not remotely agentic.**
Every call is a cold start. There is no notion of "this student has hit the same error four times", no goal it is holding, and nothing it does unprompted. It also **cannot see the running game** — even though the app already captures every console message out of the game iframe and throws that signal away.

### The panel problem, measured

Left dock has 3 modes, centre has 3 tabs, right dock has 2 modes, plus a console that opens and closes. The left dock's mode is *coupled* to the centre tab. That's 18 distinct screen states, and a child has to model the coupling to predict what happens when they click. This is worth simplifying — but only *after* the lesson/game structure is settled, because the structure decides what the panels are for.

---

## Part 2 — The course

Five modules, 22 lessons. Every module has a **teaching game** (broken → working, disposable, resettable) and one **Your Game** task (permanent, synced, grows all course).

No "welcome / how this works" module — that's the live tour on first login.

### Module 1 — How Games Are Made *(engines)*

| # | Lesson | Core idea |
|---|---|---|
| 1 | What an engine actually does | The loop: read input, update the world, draw it, 60 times a second. Side-by-side screenshots of Unity, Unreal, Godot, Phaser — same job, different clothes. |
| 2 | Why things fall and bounce | Physics is faked, and the fake is simple: position, velocity, gravity, "did these two boxes touch". |
| 3 | What a game is made of | Sprites, sheets, audio, fonts, tilemaps. Why formats matter and why a 4 MB PNG is a bug. |
| 4 | Getting it to other people | Builds and platforms. Why Windows wants a `.exe`, why a web game doesn't, why that's a real trade-off. |

**Teaching game:** the loop doesn't tick. Everything is drawn once and frozen. One line fixes it, and the world comes alive — the most satisfying possible first fix.
**Your Game:** name it, pick its shape, get a blank one running.

### Module 2 — Why Games Are Fun *(design theory through history)*

| # | Lesson | Core idea |
|---|---|---|
| 1 | One screen, one rule | Asteroids, Donkey Kong, Mario. Tiny machines. Why the constraint *made* them good — and the actual system design underneath (spawn tables, difficulty curves, the 3-lives economy). |
| 2 | The world opens up | Zelda and Sonic. Exploration as a mechanic; momentum as a mechanic. How you design a space that teaches you how to move through it. |
| 3 | A bedroom project that became a world | DeviousMUD → RuneScape Classic → RuneScape. Tick systems, persistence, the grind loop. Why people stayed for years — and what a "tick" actually is in code. |
| 4 | When the players became the makers | Minecraft, Roblox, Fortnite. The shift from playing a game to making one. Most of your students are already creators — this lesson names what they're already doing. |
| 5 | Take a formula and twist it | Pick one of the above, change exactly one rule, and say what happens. |

**Teaching game:** it *works perfectly* and is *boring*. Nothing is broken. The fix is a design fix — the jump is too floaty, the coins are worth nothing, there's no reason to take a risk. This is the module where "broken" means "not fun", which is the whole point of a design module.
**Your Game:** decide the core loop, in one sentence.

### Module 3 — Speaking to the Machine *(JavaScript + Phaser)*

| # | Lesson | Core idea |
|---|---|---|
| 1 | The things your game remembers | Variables and values. Score, lives, position — all the same idea. |
| 2 | Deciding and repeating | `if`, loops, functions. Functions framed as "a move you can name". |
| 3 | Phaser's shape | Scenes, `create`, `update`, and the objects you put in them. Why `create` runs once and `update` runs forever. |
| 4 | The three verbs | Input, movement, collision. Almost every game is these three. |
| 5 | Reading an error | How to find a bug on purpose instead of by guessing. |

**Teaching game:** the most broken one — five small bugs, one per lesson, each unlocked by the lesson that teaches it.
**Your Game:** the player moves.

Lesson 5 matters more than it looks. The research is blunt about this: most novice programmers are never taught debugging at all, and left alone they default to changing things at random until it works rather than forming a hypothesis. Every fix-it widget in this course should make the student **say what they think is wrong before it lets them edit.** That one constraint is what turns a fix-the-game exercise into teaching.

### Module 4 — How a Game Is Built *(systems architecture)*

| # | Lesson | Core idea |
|---|---|---|
| 1 | What the game is doing right now | State machines. Menu / playing / dead is the same idea as a traffic light. |
| 2 | Everything is the same thing wearing a hat | Entities and components. A coin, a bullet and an enemy differ by their parts, not their type. |
| 3 | Talking without tangling | Events instead of everything calling everything. Why the score shouldn't know the player exists. |
| 4 | Get the numbers out of the code | Enemy speed belongs in a list, not buried in a line. The first step toward data-driven design. |

**Teaching game:** it works, and it's 400 lines in one file. Nothing to fix — everything to *reorganise*. Refactoring a working thing is a real professional skill and almost nobody teaches it at this age.
**Your Game:** enemies, or whatever the loop needs.

### Module 5 — Making It Feel Good *(assets, art, juice, shipping)*

| # | Lesson | Core idea |
|---|---|---|
| 1 | A picture that moves | Sprites, sheets, animation frames. |
| 2 | Sound changes everything | The same jump with three different noises. |
| 3 | Juice | Screen shake, tweens, particles. The gap between "it works" and "it feels good". |
| 4 | Ship it | Publish. Your name on it. Someone else playing it. |

**Teaching game:** mechanically identical to a great one, and completely flat. Add the feel.
**Your Game:** finish, polish, publish.

### Where "Your Game" lives

A sixth item pinned to the bottom of the outline, always reachable, never locked. Each module drops one task into it. That keeps the two ideas of "code" visibly separate: the lesson game is **the worked example** (labelled, resettable, throwaway), Your Game is **yours** (permanent, synced, the thing on the leaderboard).

---

## Part 3 — Unlockables (brainstorm, per your ask)

The current model is Stars → buy art. That's the only reward and it's cosmetic. A better split:

- **★ Stars stay cosmetic.** Art and sound packs, bought in the Store. Unchanged.
- **XP unlocks capability.** This is the interesting half and it doesn't exist yet.

Capability unlocks worth considering, roughly in order of how much I'd want them:

| Unlock | Earned by | Why it's good |
|---|---|---|
| **The AI's Build mode** | Finishing Module 3 | You have to be able to read code before something writes it for you. Turns a limitation into a rite of passage. |
| **A second script file** | Module 4 lesson 3 | The reward for learning to split things up is *being allowed to split things up*. |
| **Particles / tweens / camera** | Module 5 lessons | Engine features arrive exactly when the lesson explains them, instead of all being available and meaningless from day one. |
| **The console** | Module 3 lesson 5 | Handing a beginner a log they can't read is noise. Handing it over as a reward, right after teaching them to read it, is a moment. |
| **Tilemaps** | Module 1 lesson 3 | — |
| **Asset packs matched to the module** | Module completion | Enemy sprites unlock with the enemies lesson. Free, and they arrive when they're wanted. |
| **A title-screen kit** | Module 5 | Fonts, a logo maker, a colour theme for their own game. |

And **badges for real practice**, which cost nothing and are the most professionally honest reward in the list: *shipped a build*, *fixed a bug without asking the AI*, *refactored something that already worked*, *found a bug in the teaching game before the lesson pointed at it*.

**One thing to design against:** don't gate anything a student needs to finish Your Game. Unlocks should widen what's possible, never block the thing they're proud of.

---

## Part 4 — Making the AI actually agentic

Right now every AI call is a cold start. Four changes, cheapest first, and the first one is nearly free:

**1. Let the AI see the game run.** The app already captures every `console.log`, warning and error out of the game iframe (`game-runner.js`, the `capture` script) and then throws it away. Feed the last N console lines into the coder and tutor context. This is a few lines of work and it closes the biggest gap in the system — the AI currently reads code and cannot see what the code *did*.

**2. A per-student profile, server-side, behind the login.** Not a transcript. A small structured record: lessons done, concepts attempted and re-attempted, error messages seen more than once, how often they reach for the AI versus try first. The tutor gets it as context. "This student has hit `undefined is not a function` four times this week" changes what a good answer looks like.

**3. Notice a stuck student.** N failed runs with no progress, or a long silence on a lesson they've opened three times → the assistant offers a nudge unprompted. This is the single most agentic thing in the list and the most valuable: the students who most need help are the ones least likely to ask.

**4. Hold a goal.** The student says what they're building in Module 2 lesson 5. The AI keeps that sentence and checks work against it. "You said you wanted a game about a cat who can't jump — this change gives the cat a jump. Sure?"

**On privacy:** the profile is behaviour, not identity — concept IDs, error strings, counters, keyed to the code-server account ID. No chat transcripts stored, no free text. That keeps it useful and keeps it defensible, and it's the League's policy call, not something I'd decide.

---

## Part 5 — Token budget (your decision, built your way)

You want students to see real token cost, capped by a per-account allotment, to teach real-world practice. Building exactly that. I raised the readability concern when you asked; you've made the call, so here's how I'd make it work *well* rather than argue it:

- **Show both numbers, not one.** The real count (`1,240 tokens · $0.021`) with a plain-English companion (`about a page and a half of reading`). Honest and legible at the same time — the same way a shop shows the price and the price-per-100g.
- **A visible allotment bar**, per account, per period. Server-enforced, not a client suggestion.
- **Cost per request shown on the message itself**, so the connection between "I asked a vague question" and "that cost more" is visible where it's learned.
- **A floor that can't be spent.** Reserve a slice of every student's allotment for the Tutor. A student who burns their budget on Build-mode requests must still be able to ask what an error means. Running out of "help" entirely is the one failure mode that turns a good lesson into a bad day.
- **A teacher view** of who's near their cap, so it's noticed before it bites.

---

## Part 6 — The build order

Eight stages. Each is shippable on its own and nothing later depends on a stage being perfect.

### Stage 0 — Close the blockers *(first, and it's small)*
Everything in Part 0's B-list. It is roughly two days of work and it gets much more expensive
later — B1 and B3 are cheap now and become a security review once there are accounts, and B2 has
to land before the first byte of student work goes to a server.
- Sandbox the game iframe; move console capture and audio fully onto `postMessage`.
- Version the saved-state schema and write the first migration (a no-op that stamps `v:1`).
- Security headers and a CSP.
- `npm test` wrapping the four existing harnesses, and a GitHub Actions workflow that runs it.

### Stage 1 — Foundations *(do first; everything else is easier after it)*
- ES modules + a tiny event bus. No bundler, no build step — native `<script type="module">`, which every target browser supports. Keeps the "open the folder and edit it" property.
- One store that owns state, with subscribe. Kills the `completeLesson` → `renderOutline` coupling class of bug.
- A storage layer with two implementations behind one interface: browser today, code server tomorrow.
- Finish the layout plan's Stage A (defer jshint/Prettier/CodeMirror addons to the Code tab, subset the icon font) — ~2 MB still to come off.

### Stage 2 — Identity and persistence
- Code-server login (primary) and GitHub OAuth (secondary), both landing on one account record.
- Server-side project and progress storage keyed to that account.
- Migration for students who already have work in `localStorage`.
- Rate limit and, later, the token budget re-keyed from the client-supplied id to the session (B3).
- Backup and a *tested* restore. Not "we have backups" — a restore someone has actually run.

### Stage 3 — Sync
- Status-bar indicator: clean / N changes / syncing / failed, click to sync.
- Push to the code server's GitHub repo for code-server accounts, to the student's own repo for GitHub accounts.
- Conflict handling that a 12-year-old can act on: "the server has a newer version — keep mine / keep theirs / see both".

### Stage 4 — The two-game structure *(the big one)*
- Split the project model into **lesson game** (per module, resettable) and **my game** (permanent).
- Rebuild the Code and Play tabs to say clearly which one you're looking at.
- Replace the challenge widget's private iframe with one that operates on the real module game.
- **Add the hypothesis step**: before the editor unlocks, the student picks or writes what they think is wrong.
- Simplify the panel coupling now that we know what the panels are for.

### Stage 5 — Course rewrite
- 47 lessons → 22 across 5 modules, per Part 2.
- Five teaching games authored, each with its broken and fixed state, each covered by `check-challenges.js`.
- The live first-login tour, replacing the welcome module.
- Retire `how-the-course-works.md`, `what-youll-build.md`, `tour-of-the-studio.md`, `play-and-tinker.md`.

### Stage 6 — Agentic AI
- Console output into AI context (do this one early, it's nearly free).
- Per-student profile and the tutor context that reads it.
- Stuck detection and the unprompted nudge.
- Goal tracking.

### Stage 7 — Budgets and unlocks
- Per-account token allotment, server-enforced, with the reserved tutor floor.
- In-chat cost display, both numbers.
- Teacher view.
- XP-gated capability unlocks and badges.

**Then** the layout plan's Stage B (responsive) and Stage D (spacing/type scales), against the *new* structure rather than the old one.

---

## Sequencing, not cutting

Since 1.0.0 is a full product, nothing below is dropped — it is ordered.

- **Stage B of the layout plan** (responsive) waits for Stage 4. The panel structure is Stage 4's
  subject; making the current three-dock layout responsive and then restructuring it is paying
  twice. It still ships in 1.0.0, just after the structure it has to adapt.
- **Leaderboards and Gallery are currently sample data with no backend.** For 1.0.0 they either
  become real (which means moderation — student-named games shown to other students need a review
  path) or they come out of the top-level nav. Shipping fake data in a product is the one option
  that isn't available.
- **Moderation is a real work item nobody has scoped yet.** Published game titles, and the games
  themselves, are student-authored content displayed to other children. That needs a policy and a
  button before the Gallery is real.

## Open questions

Blocking 1.0.0, needed from the League rather than from the code:

1. **The privacy answers** — what's stored, for how long, who sees it, the under-13 position, and
   whether student code may go to a third-party AI at all. Everything in Stage 6 depends on this.
2. **Image rights for Module 2 and Module 1** — see Part 0.
3. **Who owns this after Jay?** The handoff checklist is written for a named person, and the
   architecture decisions in Stage 1 (no build step, files over frameworks) are chosen partly to
   make that handoff survivable.

Needed soon, shapes the work but doesn't block it:

4. **How long is a class period, and how much of a lesson must fit in one?** This decides lesson
   length more than anything else in this document, and it is cheap to answer.
5. **Do teachers need a login and a view in 1.0.0?** My read is yes — "a teacher can reset a class
   and recover a student's work" is already on the release checklist, and that needs a teacher
   account to hang off.
6. **Is the Gallery playable-by-others, or a showcase?** Playable means running one student's code
   in another student's browser, which is a much bigger security question than the one in B1.
