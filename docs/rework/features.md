# Feature ledger

Every feature and idea the rework could have, and its status. The wireframes (`wireframes/`) only
contain what this file marks **In**. A feature moves to **In** when Jay decides it, and the row
records the reason, so the next person can see why something is there — or isn't.

**Status:** **In** = decided, in the wireframe · **Waiting** = worth considering, not decided ·
**Parked** = not for now · **Out** = decided against.
**Source:** *proto* = exists in the current app (reference only, see `research/04-app-inventory.md`) ·
*research* = from `research/` · *Jay* = Jay's call.

## Decided

| Feature | Status | Source | Why |
|---|---|---|---|
| Engine-style layout: top bar · left panel · centre viewport · right AI panel · bottom bar | **In** | proto, Jay | Kept "until disproven" (direction, revision). Contents of each region are not decided. |
| The AI as the focal point — one chat that teaches *and* builds | **In** | Jay | Direction. The tutor's behaviour is the model; builder and tutor merge. |
| An AI that learns the student and adapts the content | **In** | Jay | Direction (revision). Needs its own design — see open questions. |
| Designed for 10–13, new to computers | **In** | Jay | Direction (revision). A rule for every screen, not a feature. |
| The kid invents their game in minute one (tap questions → the AI builds a tiny game) | **In** | research, Jay | Shape interview, 2026-09-25. |
| Ideas are felt in the kid's own game; a separate practice game only as a backup | **In** | research, Jay | Shape interview ("Way B"). Keeps course and building connected. |
| The AI: panel as its home + one-sentence pointer bubbles, as a named character | **In** | research, Jay | Shape interview. Name and face still open. |
| Left panel = the kid's path (current unit only) | **In** | critique, Jay | Shape interview. Jay: the game's parts should appear somewhere too. |
| The game's parts shown as an engine-style list (proposed: a row of part cards under the game) | **Waiting** | Jay | Where exactly is proposed in `briefs/lesson-moment.md`. |
| Rewards: celebration + collectible concept card **and** a small stars/XP bar | **In** | Jay | Shape interview ("both"). The bar stays still mid-lesson, animates at the celebration. |
| The AI adapts pace, words, examples, and how much it builds | **In** | Jay | Shape interview. How each shows on screen is open. |
| A fun get-to-know-you opening (AI bubbles, matching pictures, picking favourite games, characters, mechanics) | **In** | Jay | Shape interview. Being shaped next (first run). |
| The engine builds itself around the kid during the first run | **In** | Jay | Shape interview (first run). Replaces the missing tour. |
| Discovery questions with reflect-back ("so, like Mario?") instead of asking for labels | **In** | Jay | Shape interview. Applies to games, kinds of fun, and role interest. |
| A learner card that evolves: picks, noticed comfort, lesson history; the kid and teacher can see and reset it | **In** | Jay | Shape interview. Never real name, birthday, school, location, photos, voice, chat transcripts. |
| First run lasts ~3–5 minutes | **In** | Jay | Shape interview. |
| The course is a game: learning happens by playing it | **In** | Jay | Direction, 2026-09-25. |
| Setting: a game studio — the kid is the new dev, the AI is their mentor, roles are characters who give quests | **In** | Jay | Shape interview. Quests = concepts; each changes the kid's game. |
| Choices branch and rejoin (order, flavour, examples, characters differ; core concepts shared) | **In** | Jay | Shape interview. Teachable at class scale. |
| Replies: 3–4 dialogue options + "say something else" (typing) | **In** | Jay, research | Shape interview. Skyrim-style; matches the research against a blank chat box. |
| Adapts to how the kid learns — from what they show, not a "learning style" label | **In** | Jay | Direction. See the note on learning styles there. |
| The AI is the course: concept web + quest outlines (people) · director (plans 2–3 quests ahead) · character agents | **In** | Jay | `course-engine.md`. People write the web and outlines; the AI improvises inside them. |
| Old concepts come back inside new quests (spaced recall) | **In** | research, Jay | "Hard to forget." `course-engine.md`. |
| The kid sees a glimpse of the plan (what's next + a teaser), not the whole map | **In** | Jay | Interview. |
| Prizes used for: new tool powers · studio unlocks · desk & avatar cosmetics | **In** | Jay | Interview. Art/sound for their game was not chosen as a prize. |
| Three layers of terms: ~25–30 owned · ~30 familiar · the rest extra | **In** | research, Jay | Round-2 decision. "Familiar" is enough for "oh, that's the Inspector." |
| Prizes are surprises for concept-bearing moments (mostly tool powers); stars are a quiet bar, never a price on a quest | **In** | research, Jay | Round-2 decision; replaces "stars/XP tick up" at each quest. |
| Skill tracking starts simple (Leitner boxes: new / learning / solid / strong); refit after a pilot | **In** | research, Jay | Round-2 decision. |
| Launch with the Front Desk + 3–4 departments; the rest unlock later | **In** | research, Jay | Round-2 decision. Which departments: open. |
| Leaderboards | **Parked** | proto, Jay | "Probably not necessary." |
| Gallery | **Parked** | proto, Jay | "Not necessary for now." |
| Code-debugging labs | **Out** | proto, critique | A no-syntax course; the critique found them the lowest point of the app. |
| Lesson widgets *as implemented* (sliders, quizzes, labs, practice) | **Out** | Jay | "Implemented very poorly." The *ideas* are listed under Waiting. |

## Waiting — from the prototype

| Feature | Source | Notes |
|---|---|---|
| The kid's game, running, in the viewport | proto | The core of the runtime. Research: should be on screen while learning. |
| Play / pause / stop / restart controls | proto | Engine feel. |
| A course path (the old outline) | proto | Critique: show only the current unit; one meaning for the left panel. |
| Lessons | proto | Fresh content; format undecided (see "the lesson moment" below). |
| Design board (sticky notes in regions) | proto | Critique rated it the best fit for the new direction. |
| Live-tuning sliders (speed, jump, gravity) — the old Inspector | proto | Critique: the best "feel it in my game" affordance. |
| Code view / file tree / console | proto | Open: hidden in a no-syntax version, a "peek", or Level 2? |
| Store — one asset size/style | proto, Jay | "More on that later." |
| Stars / XP / level in the bottom bar | proto | Open: research says rewards distract mid-lesson; critique counts the bar as part of the layout. |
| Badges | proto | |
| Undo / reset for the kid's game | proto | Research: one-click undo with checkpoints. |
| Sign-in | proto | Required for a class; the kid-facing screen needs rework (critique: cold first impression). |
| Save / sync of the kid's work | proto | Required; invisible to the kid ideally. |
| Help | proto | |
| Credits (CC0 attribution) | proto | Needed if CC0 art is used. |
| Docs (Phaser API) | proto | As a tab, likely out for this audience; the AI still uses the index. |
| Glossary tooltips | proto | |
| Telemetry | proto | Invisible; useful for the next student test. |

## Waiting — new, from the research

| Idea | Source | Notes |
|---|---|---|
| **The lesson moment:** feel it → name it → build it → prove it → celebrate | research | `01-research-summary.md`. The candidate core loop of the course. |
| Feel-it toggles: same tiny game, idea off then on | research 01 | "Juice It or Lose It." |
| Concept cards (collectible, with the Unity / Godot / Unreal names on the back) | research 01, 02 | Makes the transfer to real engines visible. |
| Roles as the frame for each unit | research 02, Jay | Direction: expose them to the roles. |
| Fix-the-broken-game missions | research 01 | Trains describing a problem to the AI. |
| Checkpoint puzzles after a build | research 01 | Game Builder Garage. |
| Concept-shaped choices in the AI chat (not a blank box) | research 03 | "How floaty? moon / normal / heavy." |
| The AI shows its plan before building | research 03 | |
| Before/after replay when the game changes | research 01, 03 | The peak moment of a lesson. |
| A named AI character with a face | research 03, critique | Open: character or labelled panel. |
| First 60 seconds: their game running, the AI says hi, one tap-able change | research 03, critique | Replaces the missing tour. |
| Instructor view (who's stuck) | critique | Secondary user. |

## Open questions that block features

- **What does "learns the student" remember, and where?** A profile of a child is personal data
  (COPPA; `docs/child-privacy-brief.md`). The prototype keeps progress in the browser; the same
  could hold for a learner profile.
- **What adapts?** Pace, reading level, which examples, which role comes next, how much the AI does?
- The four questions from the research summary: code visibility, the AI's presence, stars/XP, and
  which screen to wireframe first.
