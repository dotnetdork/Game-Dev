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

# Stage 2 — The two-game structure

**The problem, concretely.** The app has two different "code you can edit" and never says which is
which:

1. **The project** — `starter-code.js` defines one starter game (config.js, world.js, player.js,
   coins.js, game.js, main.js). It is copied into the browser on first run. All 47 lessons share
   this single copy. The Code tab edits it; the Play tab runs it.
2. **The challenge widget** — `widgets.js` builds a *separate* editor inside a lesson, with its own
   code and its own hidden iframe, completely disconnected from the above.

So a student fixes a challenge, feels like they changed something, presses Play, and their game is
exactly as it was. Nothing links the two.

**What gets built.**

### 2.1 Two projects instead of one

| | Lesson game | My game |
|---|---|---|
| Whose | The course's | The student's |
| Lifetime | One module | The whole course |
| Can be reset | Yes, freely, to broken or fixed | No (only deliberately) |
| Starts as | Deliberately broken | A blank-ish template |
| Where it's saved | `leagueLessonGame:<moduleId>` | `leagueMyGame` |

Reusing the storage layer from Stage 1, so both are just two keys with the same code behind them.

### 2.2 Saying which one you're looking at

A two-item switch in the bar above the editor: **`Module 2's game` | `My game`**. The Code tab, the
Play tab and the file list all follow it. The lesson game's side carries a visible "this is the
example — reset it any time" affordance so it never feels precious.

### 2.3 The fix-it widget edits the real module game

The in-lesson editor stops making its own private copy. It opens the module's game, scrolled to
the relevant part. Fix it in the lesson, press Play, and the thing you just fixed is the thing
that runs. This is the whole point of the stage.

### 2.4 The hypothesis step

Before the editor unlocks in a fix-it exercise, the student says what they think is wrong — either
picking from a short authored list ("the player never moves", "coins don't disappear", "it crashes
straight away") or typing it.

This is not ceremony. The debugging research is blunt: novices handed broken code default to
changing things at random until it works, learning nothing. Making them commit to a theory first is
the difference between an exercise and a slot machine. Getting the theory *wrong* is fine and gets
its own response.

### 2.5 Reset and reveal

Reset the lesson game to broken. And, after enough failed attempts, an offer to show the working
version — a student who is stuck for twenty minutes has stopped learning and needs a way out.

### 2.6 Authoring format

Lessons need to declare what they operate on. Front-matter grows:

```
game: module-2          # which teaching game this lesson touches
bug: coins-dont-vanish  # which planted bug this lesson fixes
```

`app/content/AUTHORING.md` gets the new format, and `check-challenges.js` extends to assert every
planted bug is both breakable and fixable.

**Files touched:** `starter-code.js`, `project.js`, `widgets.js`, `editor.js`, `game-runner.js`,
`files.js`, `index.html`, `styles.css`, the content authoring guide.

**Open decisions** (worth settling before starting — see the end of this file).

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

## Open decisions for Stage 2

1. Does **"my game"** start blank, or from a small working template?
2. Can the **AI edit the lesson game**, or only the student's own?
3. When a module is finished, does its **lesson game stay** available to revisit?
4. Should a stuck student be able to **reveal the working version**, and after how long?
