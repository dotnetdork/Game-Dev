# The core loop — what the kid actually does

2026-09-25. Recorded before any prototype, at Jay's request. It answers Jay's question about
wireframe 02, "what is the student even supposed to do here?" — in that screen the kid mostly tapped
options and watched the AI build, which repeats the student test's "couldn't tell what to do" and
the research's warning about kids watching an AI (`research/01-precedents.md` §12).

**Agreed shape: do the jobs, grow your game, grow your studio.** Jay picked all four candidate
loops (build your own game · do the job as minigames · run the studio · fix broken games) and
approved this synthesis, which gives each its own timescale.

## Three layers

| Timescale | What the kid does | Comes from |
|---|---|---|
| **Minutes — a shift** | Clocks into a department and **does the job** as a quick, hands-on minigame: match sounds to actions, fix a floaty jump, spot the bugs, put the frames of a jump in order. Some shifts are **broken games from "customers"** to play, diagnose and fix. | Do the job · fix broken games |
| **A class session — your game** | Every shift's result **lands in the kid's own game** — the sound they picked, the jump they fixed, the art they chose. They play it and show a friend. | Build your own game |
| **The course — your studio** | **The studio grows:** departments unlock, new characters join, real milestones (Alpha → Beta → Launch party), playtesters "review" the kid's game. Progression, not spreadsheets. | Run the studio (light) |

**Where the fun lives:** in the jobs. **The kid's game is the proof** — the thing they're proud of
and show off — without the "invent something from nothing" pressure that freezes most kids.
**The studio is the story**, and where surprise prizes naturally arrive.

## The kid's hands are always busy

The AI does the heavy lifting; the kid never just watches. Across shifts, the kid:

| Verb | What it looks like | Engine idea it builds |
|---|---|---|
| **Plays** | Actually plays games with the keyboard, constantly | Play mode, testing |
| **Notices** | Spots what feels wrong ("the jump is floaty", "I can't see the coin") | Playtesting, game feel |
| **Decides** | Picks what to change — dialogue options as design decisions | Game design |
| **Tunes** | Drags Inspector sliders themselves and feels it instantly | The Inspector, values |
| **Makes** | Places things, paints tiles, picks or draws art, picks sounds | Scene view, assets, Hierarchy |
| **Directs** | Asks the AI to build what a beginner can't do by hand | Working with a team; describing a change clearly |
| **Proves** | Fixes a broken game or solves a small puzzle with the idea | Debugging, recall |

Tuning, making and placing are direct and instant — no AI call — which is also what keeps cost down
(`research/08-ai-cost-and-originality.md`).

## Scope: start small

Four loops at once is a lot. **Start with shifts + your game**, with fix-it jobs as one kind of
shift; the studio begins as a thin layer of milestones and unlocks and grows later.

## What this changes

- **A quest is now a shift** (`briefs/lesson-moment.md` needs revising to the shift model before it
  is confirmed). The five steps (feel → name → build → prove → celebrate) still fit inside a shift.
- **The first run** (`briefs/first-run.md`) still holds — it already includes a fix-it moment (the
  intern's unfinished game) and ends with the kid's own game.
- **Wireframe 02** shows the first run's chrome and flow; it does not yet show a shift.

## Next

Jay reviews this record. Then a playable prototype of **one shift** — for example the sound
department: a customer's game has silent coins, the kid plays a matching minigame, the chosen sound
lands in their own game, they play it, and a milestone ticks forward — in the engine look
(`DESIGN.md`).
