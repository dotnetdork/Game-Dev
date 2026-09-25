# Curriculum map — the course inside the quests

**Status: draft for Jay, revised 2026-09-25** for C# peek + tweak (`00-direction.md`) and to fit
the term budget. Answers "how does this teach when there is no course?" The kid sees shifts,
tickets and their own game. This page is the syllabus underneath: what every kid gets taught, in
what order, how each idea comes back, and what code checks. Background: `core-loop.md`,
`course-engine.md`, `research/06-pedagogy-and-student-model.md` (term budget, four returns),
`research/09-industry-concepts.md` (inventory, departments, confusions).

**Engine names** come from 09 and were not checked against engine docs. Names from 09's
verified-snippet panel table (§1.0) are unmarked; the rest are **[unverified]**. The C# calls
(`PlayOneShot`, `OnTriggerEnter2D`, `Update`, `Instantiate`, `Debug.Log`) are written from memory
and marked **[verify]**. Before any of these reach kids they go into one data file (09, "Gaps and
cautions").

## 1. What a kid leaves with

After ten weeks, a 10–13-year-old has a game of their own that a friend can play: a hero, a
mechanic, a way to win and lose, sounds, art, animation and effects. Every piece came from a job
they did at the studio. They own **25 real game-dev ideas** — felt, named and used in at least four
later sessions — such as *Inspector, Hierarchy, Play mode, frame, collider, prefab, feedback,
playtest, particles*. They can say who in a studio does what. They can **read a short Unity C#
script, find the line that does a thing, and change its numbers**; writing code is an extra for
keen kids. When they open Unity a year from now, the layout and a basic script should both look
familiar.

## 2. The budget, and why the list is this size

06 sets two rules: **2–3 new technical (Tier 3) terms per session**, and **each term retrieved in 4+
later sessions**. In ten sessions the second rule means new terms stop by session 7 (S7 terms get
S8–S10 plus a same-session return). So: **~21 Tier 3 terms** at most, plus the Tier 2 studio words
06 lists separately ("plus the Tier 2 studio words"), which this map adds at **no more than one per
session**. Result: 21 Tier 3 + 4 Tier 2 = **25 owned**. To get there from the first draft (26, with
4 new terms in S1 and S2): frame and game loop became one idea (they were already taught as one);
readability and difficulty curve moved to familiar; the audio mixer moved up to owned (the shift
really teaches it, with a checked target); game state became *variable*; *script* is new, for C#.

## 3. OWNED concepts (25)

† = Tier 2 studio word. Ordered by the session that introduces it. **Evidence** is what a kid must
do or get right, and how code judges it (06 §4.1: people write the observables, code decides). A
kid owns a concept only after meeting its evidence in a *later* session.

| # | Concept | Kid definition | Unity (Unreal · Godot) | The shift that teaches it | Evidence (code checks) | Needs |
|---|---|---|---|---|---|---|
| | **S1 · Front Desk** | | | | | |
| 1 | Game engine | A giant toolbox that already knows how to draw, play sounds and do physics. | Unity (Unreal Engine · Godot) | First day: fix the intern's grey game by picking a department; the engine does the rest. | S2: sorts 6 cards into "the engine does it" / "you decide it"; 5/6. | — |
| 2 | Play mode | Press Play and your building table becomes a real game. Changes made while playing vanish. | Play mode + Game view (Play In Editor · Run F5) | Recolour the hero during Play, press Stop, see it revert (first-run beat 4). | Later edits are made in Edit mode (log). S9: routes "my fix disappeared" to "made in Play mode" (option id). | 1 |
| 3 | Hierarchy | The list of every thing in your level, like a class register. | Hierarchy (Outliner · Scene dock) | Parts fill the list as the game builds; click a name and it lights up. | Asked to "select the Coin", selects it from the Hierarchy (log: selection source), in 3 sessions. | 1 |
| | **S2 · Engineering** | | | | | |
| 4 | Inspector | Click a thing and see all its knobs. Change them here. | Inspector (Details panel · Inspector dock) | "The floaty jump": drag jump and gravity on a customer's hero until it lands the gap. | Value inside a target band, then clears the gap in play (range + play event). | 3 |
| 5 | Gravity | The game pretends things fall. It's a number you can tune. | Rigidbody 2D Gravity Scale (Simulate Physics · gravity_scale) [unverified] | Tune gravity until the jump feels right, then the same in their own game. | Predicts "higher or lower?" first; final value clears the gap, not the ceiling (range). | 4 |
| 6 | Frame & game loop | One still picture; a game draws about 60 a second. Every frame it checks the buttons, updates everything, draws. | Frame; `Update()` runs once a frame (Tick · `_process`) [unverified]; toolbar Step = one frame | Slow-mo dial down to 1 frame a second; Pause, then Step; the loop wheel lights up each frame. | Orders Listen → Think → Draw and predicts what skipping Draw does. S5: Steps to the exact frame the ball skips the wall (frame index). | 2 |
| | **S3 · Design** | | | | | |
| 7 | Mechanic | The verb: what the player *does* (jump, dodge, collect). | — (industry word) | Names the verb they picked on day one; tests which of 4 changes adds a mechanic. | Picks the change that adds a mechanic vs. only changes the look (option id). | — |
| 8 | Core loop | The few things you do over and over that make it fun. | — | Drag 3–4 action cards into a circle for their own game; play it. | Loop includes their mechanic and a reward (card ids). S4: "which moment happens most? It needs a sound." | 7 |
| 9 | Win / lose condition | What makes you win, what makes you lose. | — | Play a no-lose version (boring), add a lose rule, replay. | Their game ends in a win and a lose in one playtest (both events). | 8 |
| 10 | Playtest† | Watch someone play without helping. Where they get stuck is what to fix. | — | A bot or classmate replays their game; tap every spot they got stuck. | Taps land near the scripted stuck point (timestamp window). | 2 |
| | **S4 · Audio** | | | | | |
| 11 | Feedback† | The game answers you, so you know something happened. | — | "The silent coins" (`briefs/shift-silent-coins.md`, `wireframes/03`). | Every core-loop action in their game has a sound or visual (mapping complete). | 8 |
| 12 | Sound effect | A short sound for an action: jump, coin, ouch. | AudioClip + AudioSource (Sound Wave/Cue · AudioStreamPlayer) [unverified] | Match sounds to actions; a buzz on the coin sounds like getting hurt. | S9: "the jump is silent" asks for the right *kind* of sound (category id). | 11 |
| 13 | Audio mixer | The volume board: balance music and sounds so the important one is heard. | Audio Mixer + groups (Submix · Audio Buses) [unverified] | Music drowns the coin; mix until it cuts through, then prove it by grabbing a coin. | Coin grabbed while SFX ≥ music + margin (the wireframe's gate). S8: "can't hear the door" → remix (range). | 12 |
| 14 | Event | "When X happens, do Y." | `OnTriggerEnter2D` / UnityEvent (Begin Overlap · signals) [unverified] | The slot "when you grab a coin → play" is a when→then rule. S5's peek shows it as code. | Adds a working when→then rule to their own game that fires in play (rule + fired). | 11 |
| | **S5 · Engineering** | | | | | |
| 15 | Collider | An invisible shape that decides when things touch. It isn't the picture. | Box Collider 2D (Collision component · CollisionShape2D) [unverified] | "Fell through the floor": show hitboxes, resize the collider to fit. | Collider overlaps the sprite enough (computed). Routes the fall-through ticket to Engineering. | 4, 6 |
| 16 | Bug† | The game doing something its makers didn't mean. | — | Make the bug happen again, then fix it. | The bug fires before the fix and not after (event log). | 2 |
| 17 | Script | Instructions for one thing, written in code. Unity scripts are C#. | C# script on a GameObject, `MonoBehaviour` (Blueprint · GDScript) | The programmer drops by with `Coin.cs`, the script behind their S4 fix: which line plays the sound? (`wireframes/03`, step 6). `OnTriggerEnter2D` only runs when the colliders touch. | Picks the line that does X (option id), with a new script, in 3 later sessions. | 14, 15 |
| 18 | Variable | A named number the game remembers: pitch, speed, lives. Public ones show up in the Inspector. | public field shown in the Inspector (Blueprint variable · `@export var`) | Change `pitch` in `Coin.cs`, Save, hear it; see the same number in the Inspector. | Saved value in a target range, then heard/seen in play (save + play event). S8: lose when `lives` hits 0 (state diff). | 4, 17 |
| | **S6 · Art + Design (Alpha)** | | | | | |
| 19 | Sprite | A flat picture used as a character or object. | Sprite / Sprite Renderer (Paper2D Sprite · Sprite2D) [unverified] | Art pass: swap grey boxes for sprites in one art style. | No placeholder left on hero, enemies or pickups (asset ids). | 3 |
| 20 | Component | A thing does stuff because of the parts snapped onto it. | GameObject + Component (Actor + Component · node tree) [unverified] | The master coin shows its parts — Sprite Renderer, Collider, `Coin` (Script); snap Gravity on a plain box and it falls. | Adds the right parts for the behaviour asked (required components present). | 15, 17 |
| 21 | Prefab | A master copy. Change it and every copy changes. | Prefab (Blueprint Class · instanced scene) [unverified] | "Fix one, fix fifty": re-skin the master coin and all 20 change. | Edit made on the master, not a copy (log). S8: explains why one copy stayed giant (override). | 20 |
| 22 | Iterate† | Change it, play it, change it again. | — | The art pass goes v1 → v3 against the playtest; a version strip fills. | 2+ edit → play → edit rounds on one property (log sequence). | 10 |
| | **S7 · Animation & VFX** | | | | | |
| 23 | Animation frames | The drawings in an animation, in order. *Not* game frames. | Sprite Editor slicing + Animation window (Flipbook · AnimatedSprite2D) [unverified] | Order a jump's frames; set speed to 8–12 while the game runs at 60. | Order correct. Interleaved (confusion #2): "the walk shows 8, the game draws 60 — which is which?" | 6, 19 |
| 24 | Particles / VFX | Lots of tiny pictures shot out to make sparkles, smoke and fire. | Particle System (Niagara · GPUParticles2D) [unverified] | Explosion builder: tune count, lifetime, spread on a landing puff. | The burst shows but doesn't cover the hero (ranges + readability check). | 20 |
| 25 | Juice | Extra shake, pop and sound that make a moment feel great without changing the rules. | — | Juice board: toggle shake, squash, particles, sound, hit-pause; keep up to 3. | S9: sorts "juice or rule?" cards (answer key). | 11, 24 |

## 4. C# peek + tweak — where it lives

Peek + tweak starts **mid-course, in S5**, as the programmer's job: short (5–8 minutes), always the
script behind something already in the kid's game, never a reading lesson. Each visit is also a
disguised return of an earlier concept. Arranging lines and writing a line are extras for keen
kids; the director offers them only after a clean tweak. The app reads values back out of the
line and rejects anything it can't use, with a Console message (`00-direction.md`).

| S | Script (the kid's own game) | Peek: find… | Tweak | Returns |
|---|---|---|---|---|
| 5 | `Coin.cs` from the S4 fix | the line that plays the sound (`PlayOneShot`) [verify] | `pitch`, Save, hear it | Feedback, Sound effect, Event, Collider |
| 6 | `PlayerMove.cs` | the number the Inspector's Speed row shows | `speed`, `jumpForce` | Inspector, Gravity, Variable, Component |
| 7 | `Coin.cs` again, now spinning | the line that runs every frame (`Update`) [verify] | `spinSpeed`; keen: `Instantiate(puff)` [verify] | Frame & game loop, Particles |
| 8 | `Door.cs` (Door Problem) | the `if` that decides whether the door opens | `coinsNeeded`; keen: put 3 lines in order (Parsons) | Event, Variable, Win/lose |
| 9 | a bugged script (QA ticket) | why the jump goes down (`jumpForce = -8f`); read a Console message | fix the value | Bug, Variable, Gravity |
| 10 | the kid's choice | — | keen: write one line, e.g. `Debug.Log("Launch!");` [verify] | Script |

## 5. FAMILIAR concepts (34): met, not owned

Recognition only: met on a concept card or an "In the real world…" card, or named in passing.

| Concept | One line | Where it is met |
|---|---|---|
| Scene view (world view) | Where you build: the viewport. | S1, named by the mentor. Card: Level Viewport / 2D workspace |
| Game view | The game as the player sees it. | S1, with Play mode |
| Project window | The shelf of every file. | S1 Project drawer; S4 sound shelf |
| Console | Where the engine talks to you; errors show here. | S5 script pane (the line under the code, `wireframes/03`); S9 bug ticket |
| C# and saving | Unity's language; a script change counts only after you save and Unity rebuilds. | S5 onward, the Save button |
| Pause / Step buttons | Freeze the game; move one frame. | S2 |
| Asset | Any ingredient: a picture, a sound, a level. | S6 art pass |
| Asset Store | A shop (a lot of it free) of art and sounds. | S6 card: Fab, AssetLib |
| Project | One game's folder of everything. | S1 |
| Undo | A time machine for mistakes. | S1 onward |
| Transform | Where it is, which way it faces, how big. | S5, the top row of the Inspector |
| Coordinates (x, y) | Across and up/down. In Unity y points up. | S5 card (confusion #10) |
| Camera | The player's eye. | S6 |
| Trigger | An invisible zone that notices you walk in. | S8 door |
| Spawning | Making things appear mid-game. | S7 (`Instantiate`), S8 |
| Input | Keys, clicks and taps. | S2 |
| FPS | Frames per second. | S2 card |
| Frame drop / lag | Too few frames, so it stutters. Not internet lag. | S7 (10,000 particles) |
| Level / level design | One "room" of your game, and arranging it. | S6 |
| Difficulty curve | Harder a step at a time, without sudden walls. | S6 level-chunk order; S8 Beta reviews |
| Readability | Can you tell what things are at a glance? | S6 silhouette test |
| HUD | Score and lives drawn on top of the game. | S3 |
| Tilemap | Painting a level with square tiles. | S6 |
| Parent and child | The hat follows the knight. | S7 |
| Art style | The game's "look". | S6 |
| Keyframe | An important pose; the in-betweens are filled in. | S7 |
| Animation cycle | A loop like idle or walk. | S7 |
| Music and mood | Music sets the room's feeling. | S4, S6 |
| Game AI vs generative AI | The guard follows 4 rule cards; the mentor is a different kind of AI. | S1 (first run), S8 |
| Prototype | A quick rough version to test an idea. | S3 milestone |
| Milestones: Alpha, Beta, Launch | Studio checkpoints. | S6, S8, S10 |
| Bug report / QA tester | Steps to make it happen again; the detective who finds it. | S9 |
| Build / export | Turning the project into a game anyone can play. | S10 |
| Studio roles | Designer, programmer, artist, animator, VFX artist, sound designer, producer. | Each department head; the programmer's visits from S5; S8 |

## 6. Ten sessions

1–2 shifts per session, one sometimes a customer's broken game. Results always land in the kid's
own game. From S2, a 30-second stand-up opens each session ("what did we add last week?").

| S | Department(s) | Shifts (example) | New Tier 3 | Studio word | C# | Milestone |
|---|---|---|---|---|---|---|
| 1 | Front Desk → first pick | First day (`briefs/first-run.md`); a first shift in the picked department | Game engine, Play mode, Hierarchy | — | — | Hired |
| 2 | Engineering | "The floaty jump"; slow-mo dial | Inspector, Gravity, Frame & game loop | — | — | Engineering desk |
| 3 | Design | "Is it fun?": loop cards; add a lose rule; first playtest | Mechanic, Core loop, Win/lose | Playtest | — | Prototype stamp |
| 4 | Audio | "The silent coins"; mood pick | Sound effect, Audio mixer, Event | Feedback | — | Audio desk |
| 5 | Engineering | "Fell through the floor"; the programmer's first visit | Collider, Script, Variable | Bug | first peek + tweak | — |
| 6 | Art + Design | Art pass; "fix one, fix fifty"; silhouette test | Sprite, Component, Prefab | Iterate | `PlayerMove.cs` | **Alpha** |
| 7 | Animation & VFX | Order a jump's frames; explosion builder; juice board | Animation frames, Particles, Juice | — | `Update` | Animation desk |
| 8 | All (Door Problem) | One door; each head asks their question | — | — | `Door.cs`, an `if` | **Beta** |
| 9 | QA preview | Tickets: "which department fixes this?"; patch notes | — | — | a bugged value | Patch 1.1 |
| 10 | Front Desk + all | Build; credits; teach the new intern; show a friend | — | — | keen: one line | **Launch party** |

**Returns grid.** ● introduced · ○ comes back as a decision, ticket, prediction, intern question or
C# peek · ◐ planned retrieval later in the same session (06 §2.6). **Later** = sessions after the
introducing one. Every concept gets its ◐; it is marked only on S7, which needs it to reach four.

| Concept | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Later |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Game engine | ● | ○ | | | ○ | ○ | | | | ○ | 4 |
| Play mode | ● | ○ | ○ | | ○ | | | | ○ | ○ | 5 |
| Hierarchy | ● | ○ | | ○ | ○ | ○ | | ○ | | ○ | 6 |
| Inspector | | ● | ○ | ○ | ○ | ○ | ○ | ○ | | ○ | 7 |
| Gravity | | ● | ○ | | ○ | ○ | | | ○ | ○ | 5 |
| Frame & game loop | | ● | | | ○ | | ○ | ○ | ○ | ○ | 5 |
| Mechanic | | | ● | ○ | | ○ | | ○ | | ○ | 4 |
| Core loop | | | ● | ○ | | ○ | | ○ | ○ | ○ | 5 |
| Win / lose | | | ● | ○ | | ○ | | ○ | | ○ | 4 |
| Playtest | | | ● | ○ | | ○ | | ○ | ○ | ○ | 5 |
| Feedback | | | | ● | ○ | ○ | ○ | | ○ | ○ | 5 |
| Sound effect | | | | ● | ○ | | ○ | ○ | ○ | ○ | 5 |
| Audio mixer | | | | ● | | ○ | ○ | ○ | | ○ | 4 |
| Event | | | | ● | ○ | | ○ | ○ | ○ | ○ | 5 |
| Collider | | | | | ● | ○ | | ○ | ○ | ○ | 4 |
| Bug | | | | | ● | ○ | | ○ | ○ | ○ | 4 |
| Script | | | | | ● | ○ | ○ | ○ | ○ | ○ | 5 |
| Variable | | | | | ● | ○ | ○ | ○ | ○ | ○ | 5 |
| Sprite | | | | | | ● | ○ | ○ | ○ | ○ | 4 |
| Component | | | | | | ● | ○ | ○ | ○ | ○ | 4 |
| Prefab | | | | | | ● | ○ | ○ | ○ | ○ | 4 |
| Iterate | | | | | | ● | ○ | ○ | ○ | ○ | 4 |
| Animation frames | | | | | | | ●◐ | ○ | ○ | ○ | 3 + ◐ |
| Particles / VFX | | | | | | | ●◐ | ○ | ○ | ○ | 3 + ◐ |
| Juice | | | | | | | ●◐ | ○ | ○ | ○ | 3 + ◐ |

S7's concepts get the fewest returns. They sit last on purpose: kids ask for particles and juice
unprompted, so these get used even without a planned return.

## 7. Transfer to Unity, a year later

| They should recognise | They will NOT know |
|---|---|
| The layout: Hierarchy left, Inspector right, Project bottom, Play on top (`DESIGN.md`) | Unity's real menus, shortcuts, docking, import settings |
| "Click a thing, change its numbers in the Inspector" | How to create or organise a project; packages; version control |
| Play mode, and that changes made in it vanish | Scenes as files; loading a new scene |
| GameObjects made of Components; a Prefab is a master copy | Prefab overrides and variants in practice |
| Rigidbody gravity, colliders and "is trigger" as ideas | Physics layers, collision matrices |
| A script's shape: `using UnityEngine;`, `class … : MonoBehaviour`, `Update()` runs every frame, `OnTriggerEnter2D` runs on touch | Writing a script from scratch; their own methods; `GetComponent`; delta time; `FixedUpdate` |
| `public` numbers in a script appear in the Inspector; save, and Unity rebuilds | Types beyond a number, a word and true/false; lists; classes of their own |
| Reading a Console message calmly, and finding the line it names | Debugging with breakpoints; profiling |
| Sprite, sprite sheet, particles, sound effect, audio mixer as ideas | The Animator state machine, Shader Graph, lighting, 3D |
| Studio words: playtest, iterate, bug, feedback, Alpha/Beta | Project management, estimates, real QA process |

In one sentence: they walk in knowing *what the panels are for*, *what the words mean* and *what a
script looks like*, and still have to learn how to make Unity do it.

## 8. Old content that can seed concepts

Mining material, not reuse as-is. Live lessons are in `app/content/lessons/` and a person wrote them
(CLAUDE.md: ask before touching); archive lessons are in `docs/archive/course-v1/`. Their code is
JavaScript/Phaser, so no code carries over; the *ideas* do.

| Concept(s) | Seed | What's worth taking |
|---|---|---|
| Frame & game loop, engine | `lessons/what-an-engine-does.md` ("Read, update, draw"); `course-v1/the-game-loop.md`, `what-is-an-engine.md`, `tour-of-engines.md` | The loop wheel; engine tour as "real world" cards |
| Gravity, collider | `lessons/physics-and-collision.md` ("Why games fake it", tunnelling) | The S5 frame-step bug |
| Component, prefab | `lessons/entities-and-components.md` | The snap-on-parts shift |
| Event | `lessons/events-not-tangles.md` | The "announcing" idea behind when→then |
| Variable | `lessons/values-and-variables.md` (the idea of named numbers, not its syntax). `lessons/game-state.md` is about *modes*, a different idea: extra | Named numbers the game remembers |
| Core loop, mechanic, win/lose | `lessons/the-core-loop.md`; `course-v1/mechanics-rules-core-loop.md`, `ingredients-of-fun.md`, `challenge-add-a-fail-state.md` | Loop cards; the no-lose version |
| Feedback, sound effect, mixer | `lessons/feedback.md` ("four ways to say that worked"), `lessons/sound-design.md` ("short, sharp, not annoying", "music sets the room") | Silent-coins lines; the mood pick |
| Juice, particles | `lessons/juice.md`; `course-v1/what-is-juice.md`, `challenge-make-a-hit-feel-great.md` | Juice board; S9 juice-or-rule sort |
| Sprite, animation frames | `lessons/sprites-and-animation.md` ("frames in a row", "speed changes everything") | Frame ordering; animation speed |
| Playtest, iterate | `course-v1/playtesting.md` ("don't explain, just watch"), `play-and-tinker.md` | The playtest rule, word for word |
| Bug, Console | `lessons/reading-an-error.md` ("the message is not shouting at you") | S9's Console message; the tone of every error the tweak step shows |
| Roles (familiar) | `course-v1/people-behind-a-game.md`, `designers-programmers-artists.md`, `producers-and-qa.md` | "Which department fixes this?" tickets |
| Launch, scope | `lessons/ship-it.md`, `lessons/scope-and-cutting.md`; `course-v1/launch-your-game.md` | S10 checklist; a producer teaser |

## Decided in this revision (Jay can overturn any)

- **Sound effect stays owned**, and so does the audio mixer, so Audio owns real words; the shift
  brief now says the same.
- **The budget** counts Tier 3 terms (≤3 a session) with Tier 2 studio words on top (≤1), per 06.
- **The Console is shown**, as one line under the script pane, from S5.
- **The Door Problem stays at S8** and becomes the session where C#'s `if` arrives.

## Open questions for Jay

1. **25 owned** (21 technical + 4 studio). Is that the right cut, and are readability and difficulty
   curve fine as familiar?
2. **Late concepts.** Animation, particles and juice only reach the minimum returns. Art and
   Animation earlier (S4–S5), Audio later?
3. **Department pick.** Day one lets the kid pick a department. Does that change only S1's second
   shift (this map's assumption) or the whole order? The director needs a rule.
4. **QA, Production and Publishing.** S9–S10 preview QA and Publishing. Too early, given "unlock later"?
5. **Who verifies the engine names and C# calls** ([unverified], [verify]), and when? Before any card
   goes to kids.
