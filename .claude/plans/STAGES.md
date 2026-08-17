# The stages, in detail

**A stage = a chunk of work that leaves the app working when it's finished.** Not a deadline.
Login moved to the end (Jay's call, 17 Aug 2026) because only GitHub sign-in can be built and
tested today — the League code server needs to be understood first.

Order: **0 ✅ → 1 ✅ → 2 → 3 → 4 → 5 → 6 → 7**

---

## Stage 0 — Fix what was broken or unsafe ✅ DONE

- The game frame could reach into the app: write your progress, read cookies, call
  `completeLesson()` directly. Now walled off.
- Saved work had no version number, so any future change to its shape would have destroyed it
  silently. Now versioned, migrated, and unreadable data is quarantined instead of overwritten.
- No security headers at all. Now has them.
- No automatic tests. Now `npm test` runs six of them, and CI runs it on every push.

## Stage 1 — Solid foundations ✅ DONE

- First load 5,153 KB → ~840 KB; requests 250 → 33.
- One file owns saving, so pointing it at a server later is a one-file change.
- Things announce what happened instead of calling five other functions by name.
- A test that boots the real app and checks it comes up.

*Deliberately skipped:* converting the 12 JavaScript files to a modern module system. It touches
all 3,000 lines, the benefit is tidiness rather than anything visible, and Stage 2 rewrites a good
chunk of it anyway.

---

# Stage 2 — The lesson lab

## DECIDED 17 Aug 2026 — and it made this stage much smaller

The first draft of this stage proposed two projects as **peers**: two entries in a file list, both
edited in the same editor, with a switcher to flip between them. It needed four policy decisions
before it could start, which was the tell — four open policy questions means the structure is
wrong, not that there is a to-do list.

**The decision instead: they are different kinds of thing.**

> **The Code tab is the student's game. Always. Only.**
> **Teaching games live inside lessons — a bench you work at, not a thing you own.**

No switcher, because there is no decision for the student to make. The module's game never appears
in the file tree, never appears in the Play tab, never competes for the word "your".

**All four policy questions dissolved into things the app already does:**

| Question | Answer under the reframe |
|---|---|
| Does "my game" start blank or from a template? | Gone. One project, the starter game, exactly as today |
| Can the AI edit the lesson game? | Gone. Build mode is off in a lab — the existing `ai: off` front-matter setting |
| Does the lesson game persist? | Gone. Lab state saves through the activity ledger that already exists |
| Reveal the answer when stuck? | Reuse the quiz retry rule already shipped: feedback first, teach on the second failure |

**And the cost dropped.** The Code tab is *already* only the student's game — there is no second
project today, and the challenge widget already renders its own editor and its own sandboxed view
inside the lesson. The structure chosen is close to what exists. This stage is no longer a
restructure; it is making the lab good.

**The bridge between the two:** each module ends by applying the technique to the student's own
game, by hand. Worked example, then independent practice.

### Still open — the reward for doing it in your own game

Jay, on whether a student can copy lab code into their own game: no copy button — they redo it
themselves — **but** completing the redo should award unlockables that Stars cannot buy, verified
by an agent that checks whether the feature really landed in their game. Circling back to this.

One design note for when we do. An AI judging "did you implement this?" is wrong in two directions,
and one of them is much worse: refusing a student who *did* the work is infuriating, while granting
one who didn't just cheapens the badge. So:

- check deterministically wherever possible (a tween is `this.tweens.add` — that is a parse, not a
  judgement, and the app already has four validators built this way)
- let the AI only ever **grant**, never deny — it can spot an equivalent solution the parser missed
- never gate progress on it; it is a bonus, not a door

---

## The problem this stage solves

The app has two different "code you can edit" and never says which is which:

1. **The project** — `starter-code.js` defines one starter game (config.js, world.js, player.js,
   coins.js, game.js, main.js). It is copied into the browser on first run. All 47 lessons share
   this single copy. The Code tab edits it; the Play tab runs it.
2. **The challenge widget** — `widgets.js` builds a *separate* editor inside a lesson, with its own
   code and its own hidden iframe, completely disconnected from the above.

So a student fixes a challenge, feels like they changed something, presses Play, and their game is
exactly as it was. Nothing links the two.

**What gets built.** The existing challenge widget grows into a lab. It already has a task, an
editor, a sandboxed stage, a run button and a status line — so this is six additions to something
that works, not a rewrite.

### 2.1 It runs a real game, not a bare canvas

The challenge stage today is a 300×200 canvas with a `win()` function. A lab needs Phaser and the
student's owned assets, the same way the Play tab does — so a module's game can actually be a game.

### 2.2 It reads as the course's bench, not your code

Visually distinct from the Code tab: its own header naming the module, a permanent "this is the
example" note, and a reset control in plain sight. Nothing about it should suggest ownership.

### 2.3 Lab work survives leaving the lesson

A 50-minute class gets interrupted. Edits save per lesson through the activity ledger, which
already does exactly this for quiz answers.

### 2.4 The hypothesis step

Before the editor unlocks in a fix-it exercise, the student says what they think is wrong — either
picking from a short authored list ("the player never moves", "coins don't disappear", "it crashes
straight away") or typing it.

This is not ceremony. The debugging research is blunt: novices handed broken code default to
changing things at random until it works, learning nothing. Making them commit to a theory first is
the difference between an exercise and a slot machine. Getting the theory *wrong* is fine and gets
its own response.

### 2.5 Reset, hint, and a way out

Reset to broken, always available. Then the quiz retry rule applied to runs: a first failure gets
feedback on what they actually tried, a later one gets taught the answer. A student stuck for
twenty minutes has stopped learning and needs a door, not a wall.

### 2.6 More than one file

Module 4's lab is a 400-line program to reorganise, so the lab needs a small file strip. Single-file
labs never show it.

### 2.7 Authoring format

`app/content/AUTHORING.md` gains the lab block: the files, which one is broken, the hypothesis
options, the success condition, and the worked answer. `check-challenges.js` extends to assert
every lab is both broken to start with and fixable.

**Files touched:** `widgets.js` (the lab), `styles.css`, `project.js` (lab state in the ledger),
`game-runner.js` (share the Phaser harness), the content authoring guide.

**Known constraints, not yet solved:**

- **Screen space.** The lesson column is 756px on a 1366 laptop. Code beside game will not fit —
  it stacks, game above code. Stage 6 helps but does not remove this.
- **Multi-file labs** are more work than a single editor and only Module 4 needs them; they can
  land after the rest of the stage.

---

# Stage 3 — Rewrite the course

47 lessons → 22 across 5 modules, per the structure already agreed:

1. **How Games Are Made** — engines, physics, assets, builds (4 lessons)
2. **Why Games Are Fun** — Asteroids → Mario → Zelda → RuneScape → Minecraft/Roblox/Fortnite (5)
3. **Speaking to the Machine** — JavaScript + Phaser, ending on reading an error (5)
4. **How a Game Is Built** — state, entities, events, data out of code (4)
5. **Making It Feel Good** — sprites, sound, juice, shipping (4)

**Also in this stage:**

- **Five teaching games.** Each needs a broken state, a fixed state, and one planted bug per
  lesson. Two of them are unusual on purpose: Module 2's game *works perfectly and is boring* (the
  fix is a design fix), and Module 4's game *works fine and is 400 lines in one file* (the task is
  to reorganise it).
- **The first-run tour** — the popup walkthrough that replaces the welcome module.
- **Retire** `how-the-course-works`, `what-youll-build`, `tour-of-the-studio`, `play-and-tinker`.
- **Images.** Modules 1 and 2 want screenshots of games and engines that are all copyrighted. The
  cheapest route is also the better teaching: original diagrams showing the *system* rather than
  the screen. Engine vendors' press kits cover the rest.

**Suggested approach:** build one module end to end first, get your reaction, then do the other
four. Writing 22 lessons before you've seen one is how you write 22 lessons twice.

---

# Stage 4 — Make the AI feel alive

Right now every AI request is a cold start. Four changes, cheapest first.

### 4.1 Let it see the game run *(nearly free, biggest gap)*

`game-runner.js` already captures every log, warning and error the game produces and posts it to
the app, where `console-dock.js` displays it — and then it is thrown away. The AI reads the
student's code and has no idea what happened when it ran.

Sending the last handful of console lines with each request closes that. "It says `undefined is not
a function` on line 40" is a completely different conversation from "here is my code, help".

### 4.2 Notice a stuck student

Track a few honest signals: runs ending in an error, the same error message repeating, a lesson
opened three times with nothing resolved, a long silence. Past a threshold, the assistant offers
help without being asked.

This is the most valuable item in the stage, because the students who most need help are the least
likely to ask for it.

### 4.3 Hold onto the goal

The student writes one sentence about what they're building. It is kept with their project and
handed to the AI as context, so it can say "you said you wanted a game about a cat who can't jump —
this change gives the cat a jump, sure?"

### 4.4 A review at the end of a module

An agent that looks at *their* game and gives feedback against what they said they were making.

**Files:** `ai.js`, `server.js`, `app/ai/agents/*`, new skill files.

---

# Stage 5 — Rewards worth having

Today: Stars buy art. That's the entire reward system, and it's cosmetic.

**The split:** ★ Stars stay cosmetic (art and sound in the Store). **XP unlocks capability** — this
half doesn't exist yet and is the interesting one.

| Unlock | Earned by | Why |
|---|---|---|
| The AI's **Build mode** | Finishing Module 3 | You should be able to read code before something writes it for you. Turns a restriction into a rite of passage |
| A **second code file** | Module 4 | The reward for learning to split things up is being allowed to split things up |
| **Particles, tweens, camera** | Module 5 lessons | Features arrive when the lesson explains them, not all at once on day one |
| **The console** | Module 3's debugging lesson | Handing a beginner a log they can't read is noise; handing it over right after teaching them to read it is a moment |
| **Asset packs** | Module completion | Enemy sprites unlock with the enemies lesson |

Plus **badges for real practice**, which cost nothing to build: *shipped a build*, *fixed a bug
without asking the AI*, *refactored something that already worked*, *spotted a bug before the
lesson pointed at it*.

**Rule:** never gate anything needed to finish *their* game. Unlocks widen what's possible; they
never block the thing a student is proud of.

---

# Stage 6 — Make it fit any screen

Measured in the audit: the two side panels claim a fixed 600px forever. Centre column is 1320px at
1920 wide, **424px at 1024**, and at 820 the Learn/Code/Play tabs literally don't fit and get cut
off. Lesson text runs 92 characters per line on a big monitor and 42 on a small laptop; comfortable
is 45–75.

- **Breakpoints:** ≥1440 both panels; 1180–1440 the AI panel auto-collapses to the floating button
  that already exists; below 1180 the lesson list becomes a slide-over.
- **Cap the reading width** to about 68 characters, with a floor so it never gets squeezed.
- **One content width** instead of the four different ones in use now.
- **Panel drag limits follow the breakpoint**, so a student on a small screen can actually reclaim
  the space.
- **Then the tidy-up:** 25 different font sizes → 8, 25 spacing values → 8, 12 corner radii → 4,
  and name the eight colours currently hard-coded dozens of times.

This waits until after Stage 2 because Stage 2 rebuilds these panels. Doing it first means doing it
twice.

---

# Stage 7 — Login, server saving, and sync

Last, by decision.

- **GitHub sign-in** — buildable and testable now, on its own.
- **Code server sign-in** — built to the same shape, behind the same interface, but it can't be
  finished until we know how the real one works. Three questions when we get there: how a student
  signs in, what it hands back, and how it creates their repo.
- **Work saved to the server**, keyed to the account, with a tested restore.
- **Migration** for anyone with work already in their browser.
- **The sync button** in the status bar: clean / *3 changes* / syncing / failed, click to sync.
- **Conflict handling** a 12-year-old can act on: "the server has a newer version — keep mine, keep
  theirs, or see both".
- **Rate limiting and token budgets keyed to the session** rather than to a number the browser
  makes up (today a student can reset their own limit by clearing storage).
- **The AI remembering a student** — which concepts they've retried, which errors keep recurring.
  Behaviour, not transcripts.

---

## What is *not* blocked by login being last

Worth stating, because it looked like more:

- **Showing token cost in the chat** works now; only the per-student *cap* needs an account.
- **The AI seeing your game's errors** needs nothing.
- **XP unlocks** work off progress already stored in the browser.
- **Stages 2, 3 and 6** never touch accounts at all.

## Open decisions

**Stage 2's four are settled** — see the top of that stage. The reframe dissolved all of them.

**Carried forward, for Stage 5:** what unlockables a student earns for applying a lab's technique
to their own game, and how an agent verifies they really did. Direction is set (no copy button,
reward the redo, deterministic checks first, AI may only grant and never deny); the specifics are
open.
