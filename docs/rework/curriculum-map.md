> **Update (2026-09-25):** Jay decided C# is in — **peek + tweak** from mid-course (see
> `00-direction.md`). Engineering shifts show the real C# behind a change and let kids edit values;
> this map's "no code" assumptions and the transfer table need revising to match.

# Curriculum map — the course inside the quests

**Status: draft for Jay, 2026-09-25.** Answers "how does this teach when there is no course?" The
kid sees shifts, tickets and their own game. This page is the syllabus underneath: what every kid
gets taught, in what order, how each idea comes back, and what code checks. Background:
`core-loop.md` (shifts → your game → your studio), `course-engine.md` (concept web, director,
checker), `research/06-pedagogy-and-student-model.md` (term budget, four returns),
`research/09-industry-concepts.md` (inventory, backbone, departments, confusions).

**Engine names.** All engine names come from 09; I did not check them against engine docs. Names
from 09's verified-snippet panel table (§1.0) are unmarked. Every other name is marked
**[unverified]**. Before any of these reach kids, they should go into one data file (09, "Gaps and
cautions").

## 1. What a kid leaves with

After ten weeks, a 10–13-year-old has a game of their own that a friend can play: a hero, a
mechanic, a way to win and lose, sounds, art, animation and effects. Every piece of it came from a
job they did at the studio. They can name about 26 real game-dev ideas because they felt each one
and used it at least five times. Examples: *Inspector, Hierarchy, Play mode, frame, collider,
prefab, feedback, playtest, particles*. They can say who in a studio does what. When they open
Unity a year from now, the layout should look familiar. They will not know how to write code, and
the course never pretends they do.

## 2. OWNED concepts (26)

† = a Tier-2 studio word (general, cheaper to learn; 06 §1.2). **S*n*** = the session that
introduces it. The **Evidence** column is what a kid must do or get right, and how code judges it
(06 §4.1: people write the observables, code decides). A kid does not own a concept until they
have met its "use" evidence in a later session, not only on the day it was taught.

| # | Concept | Kid definition | Dept | Unity (Unreal · Godot) | The shift that teaches it (kid does) | Evidence (code checks) | Needs |
|---|---|---|---|---|---|---|---|
| 1 | Game engine | A giant toolbox that already knows how to draw, play sounds and do physics. | Front Desk | Unity (Unreal Engine · Godot) | S1: fix the intern's grey game by picking a department; the engine does the rest. | S2: sorts 6 cards into "the engine does it" and "you decide it"; answer key, 5/6 right. | — |
| 2 | Play mode | Press Play and your building table becomes a real game. Changes made while playing vanish. | Front Desk | Play mode + Game view (Play In Editor · Run F5) | S1: recolour the hero during Play, press Stop, see it revert (first-run beat 4). | Later edits are made in Edit mode (log: mode at edit time). S9: routes the ticket "my fix disappeared" to the answer "made in Play mode" (option id). | 1 |
| 3 | Hierarchy | The list of every thing in your level, like a class register. | Front Desk | Hierarchy (Outliner · Scene dock) | S1: parts fill the list as the game builds; click a name and it lights up in the world. | Asked to "select the Coin", the kid selects it from the Hierarchy, not the viewport (log: selection source). Checked in 3 sessions. | 1 |
| 4 | Mechanic | The verb: what the player *does* (jump, dodge, collect). | Design | — (industry word) | S1: picks their game's verb; S2 tunes that verb. | S3: picks which of 4 changes adds a *mechanic* and which only changes the look (option id). | — |
| 5 | Inspector | Click a thing and see all its knobs. Change them here. | Front Desk | Inspector (Details panel · Inspector dock) | S2 "floaty jump" ticket: drag the jump and gravity sliders on a customer's hero until it lands the gap. | Sets a value inside a target band, then clears it in play (value range + a play-through event). | 3 |
| 6 | Gravity (physics) | The game pretends things fall. It is a number you can tune. | Engineering | Rigidbody 2D Gravity Scale (Simulate Physics · RigidBody2D gravity_scale) [unverified] | S2: tune gravity until the jump feels heavy enough, then do the same in their own game. | Before the change, predicts "higher or lower?" (06 §2.7 #5). Final value clears the gap but not the ceiling (range check). | 5 |
| 7 | Frame | One still picture. A game draws about 60 of them a second, like a flipbook. | Engineering | Frame; toolbar Step = one frame | S2: slow-mo dial down to 1 frame a second; press Pause, then Step. | S5: uses Step to find the exact frame where the ball skips through the wall (frame index clicked matches). | 2 |
| 8 | Game loop | Every frame: check the buttons, update everything, draw. Again and again. | Engineering | Update() (Tick · _process) [unverified] | S2: the loop wheel (Listen → Think → Draw) lights up in time with the game; slow it down. | Puts the 3 cards in order and predicts what happens if "Draw" is skipped (order + option id). | 7 |
| 9 | Core loop | The few things you do over and over that make the game fun. | Design | — | S3: drag 3–4 action cards into a circle for their own game; play it. | The loop includes their mechanic and a reward (card ids). S4: "which moment happens most? It needs a sound." | 4 |
| 10 | Win / lose condition | What makes you win, what makes you lose. | Design | — | S3: play a no-lose version (boring), add a lose rule, replay. | Their game ends in a win and a lose within the same playtest (both events fire). | 9 |
| 11 | Game state | The notebook of numbers the game remembers: score, lives, time. | Engineering | Variables/fields shown in the Inspector (Variables · exported vars) [unverified] | S3: choose which numbers the game must remember; set the starting lives. | Required fields exist and change during play (state diff). S8: lose happens when lives = 0. | 10 |
| 12 | Playtest† | Watch someone play without helping. Where they get stuck is what to fix. | Design | — | S3: watch a bot or a classmate replay their game; tap every spot where they got stuck. | Taps land within a few seconds of the scripted stuck point (timestamp window). | 2 |
| 13 | Iterate† | Change it, play it, change it again. | Design | — | S4: mix, listen, remix; a version strip fills v1 → v3. | At least 2 edit → play → edit rounds on the same property (log sequence). | 5 |
| 14 | Feedback† | The game answers you, so you know something happened. | Design | — | S4 "silent coins": hear the silence, then the fix (`briefs/shift-silent-coins.md`). | Every core-loop action in their game has feedback, a sound or a visual (mapping table complete). | 9 |
| 15 | Sound effect | A short sound for an action: jump, coin, ouch. | Audio | AudioClip + AudioSource (Sound Wave/Cue · AudioStreamPlayer) [unverified] | S4: match sounds to actions. A buzz on the coin sounds like getting hurt. | S9: the ticket "the jump in your game is silent" asks for the right *kind* of sound (category id). | 14 |
| 16 | Event | "When X happens, do Y." | Engineering | OnTriggerEnter / UnityEvent (Begin Overlap · signals) [unverified] | S4: snap a card on the coin: "when the player touches it, play the ding". | Adds a working when→then rule to their own game that fires in play (rule exists + fired). | 14 |
| 17 | Collider | An invisible shape that decides when things touch. It is not the picture. | Engineering | Box Collider 2D (Collision component · CollisionShape2D) [unverified] | S5 "fell through the floor": turn on "show hitboxes", then resize the collider to fit. | Collider overlaps the sprite by more than a set amount (computed). Routes the fall-through ticket to Engineering. | 7, 16 |
| 18 | Component | A thing does stuff because of the parts snapped onto it. | Engineering | GameObject + Component (Actor + Component · node tree) [unverified] | S5: a plain box; snap on Gravity (it falls), then Collider (it lands). | Adds the right parts for the behaviour asked for (required components present). | 3, 6 |
| 19 | Prefab | A master copy. Change it and every copy changes. | Engineering | Prefab (Blueprint Class · instanced scene) [unverified] | S5: fix one coin's collider on the master, and all 20 coins are fixed. | The edit is made on the master, not a copy (log: edit target). S8: explains why one copy stayed giant (override). | 17, 18 |
| 20 | Bug† | The game doing something its makers didn't mean. | Engineering (QA later) | — | S5: make the bug happen again, then fix it. | The bug fires in play before the fix and not after (event log). | 2 |
| 21 | Sprite | A flat picture used as a character or object. | Art | Sprite / Sprite Renderer (Paper2D Sprite · Sprite2D) [unverified] | S6 art pass: swap grey boxes for sprites in one art style. | No placeholder is left on the hero, enemies or pickups (asset ids). | 3 |
| 22 | Readability | Can you tell what things are at a glance? Test with shape and colour. | Art | — | S6 silhouette test: pick the hero and enemies that read as black shapes; make danger red. | Hero-to-background contrast is above a threshold (computed). Picks the readable silhouette 3 of 3 times. | 21 |
| 23 | Difficulty curve | How the game gets harder, a step at a time, without sudden walls. | Design | — | S6: put 4–5 level chunks in order; a playtest bot "gets frustrated" at spikes. | The order climbs, with at most one rest dip (rule check). | 10, 12 |
| 24 | Animation frames | The drawings in an animation, shown in order. They are *not* game frames. | Animation & VFX | Sprite Editor slicing + Animation window (Paper2D Flipbook · AnimatedSprite2D) [unverified] | S7: put a jump's frames in order; set the animation speed to 8–12 while the game runs at 60. | Frame order correct. Interleaved question (confusion #2): "the walk shows 8, the game draws 60. Which is which?" | 7, 21 |
| 25 | Particles / VFX | Lots of tiny pictures shot out to make sparkles, smoke and fire. | Animation & VFX | Particle System (Niagara · GPUParticles2D) [unverified] | S7 explosion builder: tune count, lifetime and spread on a landing puff. | The burst shows but does not cover the hero (ranges + readability check). | 18, 22 |
| 26 | Juice (game feel) | The extra shake, pop and sound that make a moment feel great without changing the rules. | Design (taught by Animation & VFX) | — | S7 juice board: toggle shake, squash, particles, sound and hit-pause on a dull game; keep up to 3 for one moment in their game. | S9: sorts "juice or rule?" cards (answer key; reuses the `what-is-juice.md` distinction). | 14, 25 |

## 3. FAMILIAR concepts (32): met, not owned

Recognition only. Met on a concept card or an "In the real world…" card, or named in passing by a
character.

| Concept | One line | Where it is met |
|---|---|---|
| Scene view (world view) | Where you build: the viewport. | S1, named by the mentor. Card: Level Viewport / 2D workspace |
| Game view | The game as the player sees it. | S1, with Play mode |
| Project window | The shelf of every file. | S1 Project drawer ("your cards"); card: Content Browser / FileSystem dock |
| Console | Where the engine talks to you; red = broken. | S5 bug shift, if the console is shown at all (`features.md` row 65 is open) |
| Pause / Step buttons | Freeze the game; move one frame. | S2 |
| Asset | Any ingredient: a picture, a sound, a level. | S6 art pass |
| Asset Store | A shop (a lot of it free) of art and sounds. | S6 card: Fab, AssetLib |
| Project | One game's folder of everything. | S1 |
| Undo | A time machine for mistakes. | S1 onward |
| Transform | Where it is, which way it faces, how big it is. | S5, the top row of the Inspector |
| Coordinates (x, y) | Across and up/down. In Unity y points up; in many 2D tools it points down. | S5 card (confusion #10) |
| Camera | The player's eye. | S6 |
| Trigger | An invisible zone that notices you walk in. | S8 door (Door Problem) |
| Spawning | Making things appear mid-game. | S8 |
| Input | Keys, clicks and taps: how the player talks to the game. | S2 |
| FPS | Frames per second. | S2 card |
| Frame drop / lag | Too few frames, so the game stutters. Not the same as internet lag. | S7 (10,000 particles) |
| Level / level design | One "room" of your game, and arranging it. | S6 |
| HUD | Score and lives drawn on top of the game. | S3 |
| Tilemap | Painting a level with square tiles. | S6 |
| Parent and child | The hat follows the knight. | S7 |
| Art style | The game's "look". | S6 |
| Keyframe | An important pose; the in-between drawings are filled in. | S7 |
| Animation cycle | A loop like idle or walk. | S7 |
| Music and mood | Music sets the room's feeling. | S4, S6 |
| Audio mixer | Balance the volumes so the important sound is heard. | S4 (shift brief) |
| Game AI vs generative AI | The guard follows 4 rule cards. The mentor is a different kind of AI. | S1 (first-run brief), S8 |
| Prototype | A quick rough version to test an idea. | S3 milestone |
| Milestones: Alpha, Beta, Launch | Studio checkpoints for a game. | S6, S8, S10 |
| Bug report / QA tester | Steps to make it happen again; the detective who finds it. | S9 (QA preview) |
| Build / export | Turning the project into a game anyone can play. | S10 |
| Studio roles | Designer, programmer, artist, animator, VFX artist, sound designer, producer. | Each department head; S8 Door Problem |

## 4. Ten sessions

Each session has 1–2 shifts (one of them sometimes a customer's broken game). Results always land
in the kid's own game. A 30-second stand-up opens every session from S2 ("what did we add last
week?" with icon chips; 06 §2.7 #6).

| S | Department(s) | Shifts (example) | New owned | Studio milestone |
|---|---|---|---|---|
| 1 | Front Desk → first department pick | First day (`briefs/first-run.md`); first shift in the picked department | Game engine, Play mode, Hierarchy, Mechanic | Hired |
| 2 | Engineering | "The floaty jump" (tune); slow-mo dial | Inspector, Gravity, Frame, Game loop | Engineering desk unlocked |
| 3 | Design | "Is it fun?": core-loop cards; add a lose rule; first playtest | Core loop, Win/lose, Game state, Playtest† | Prototype stamp |
| 4 | Audio | "The silent coins" (brief); mood pick | Feedback†, Sound effect, Event, Iterate† | Audio desk unlocked |
| 5 | Engineering | "Fell through the floor" (fix a customer's game); "fix one, fix fifty" | Collider, Component, Prefab, Bug† | — |
| 6 | Art + Design | Art pass on a greybox; silhouette test; order the level chunks | Sprite, Readability, Difficulty curve | **Alpha** (creative director plays it) |
| 7 | Animation & VFX | Order a jump's frames; explosion builder; juice board | Animation frames, Particles, Juice | Animation desk unlocked |
| 8 | All (Door Problem) | One door in their game; each head asks their question | — (Trigger and Spawning met as familiar) | **Beta** (playtesters "review" it) |
| 9 | QA preview | Playtester tickets: "which department fixes this?" (interleaving); patch notes | — | Patch 1.1 |
| 10 | Front Desk + all | Build it; credits; teach the new intern; show a friend | — | **Launch party** |

**Returns grid.** ● introduced · ○ comes back as a decision, ticket, prediction or intern question
· ◐ planned retrieval later in the same session (06 §2.6, encounter 1). **Later** counts the
sessions after the one that introduced it.

| Concept | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Later |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Game engine | ● | ○ | | | ○ | ○ | | | | ○ | 4 |
| Play mode | ● | ○ | ○ | | ○ | | | | ○ | ○ | 5 |
| Hierarchy | ● | ○ | | ○ | ○ | ○ | | ○ | | ○ | 6 |
| Mechanic | ● | ○ | ○ | | | ○ | | ○ | | ○ | 5 |
| Inspector | | ● | ○ | ○ | ○ | ○ | ○ | ○ | | ○ | 7 |
| Gravity | | ● | ○ | | ○ | | ○ | | ○ | ○ | 5 |
| Frame | | ● | | | ○ | | ○ | | ○ | ○ | 4 |
| Game loop | | ● | ○ | | ○ | | | ○ | | ○ | 4 |
| Core loop | | | ● | ○ | | ○ | | ○ | ○ | ○ | 5 |
| Win / lose | | | ● | ○ | | ○ | | ○ | | ○ | 4 |
| Game state | | | ● | | ○ | | | ○ | ○ | ○ | 4 |
| Playtest | | | ● | ○ | | ○ | | ○ | ○ | ○ | 5 |
| Feedback | | | | ● | ○ | ○ | ○ | | ○ | ○ | 5 |
| Sound effect | | | | ● | ○ | | ○ | ○ | ○ | ○ | 5 |
| Event | | | | ● | ○ | | ○ | ○ | ○ | ○ | 5 |
| Iterate | | | | ● | | ○ | ○ | ○ | ○ | ○ | 5 |
| Collider | | | | | ● | ○ | | ○ | ○ | ○ | 4 |
| Component | | | | | ● | ○ | ○ | ○ | | ○ | 4 |
| Prefab | | | | | ● | ○ | | ○ | ○ | ○ | 4 |
| Bug | | | | | ● | ○ | | ○ | ○ | ○ | 4 |
| Sprite | | | | | | ● | ○ | ○ | ○ | ○ | 4 |
| Readability | | | | | | ● | ○ | ○ | ○ | ○ | 4 |
| Difficulty curve | | | | | | ● | ○ | ○ | ○ | ○ | 4 |
| Animation frames | | | | | | | ●◐ | ○ | ○ | ○ | 3 + ◐ |
| Particles / VFX | | | | | | | ●◐ | ○ | ○ | ○ | 3 + ◐ |
| Juice | | | | | | | ●◐ | ○ | ○ | ○ | 3 + ◐ |

Every concept also gets its ◐ return in the session that introduces it. It is only marked on the S7
rows because those rows need it to reach four returns. **The S7 concepts get the fewest returns
possible.** They were put last on purpose: kids ask for particles and juice without being prompted,
so these ideas get used even when no return is planned. **The budget is over in S1 and S2** (4 new
terms against 06's limit of 2–3). What makes this lighter: "game engine" and "mechanic" are words
kids half-know, and frame and game loop are taught as one idea. If the pilot shows overload, move
Game loop to S5.

## 5. Transfer to Unity, a year later

| They should recognise | They will NOT know |
|---|---|
| The layout: Hierarchy on the left, Inspector on the right, Project window at the bottom, Play at the top (the course copies this; `DESIGN.md`) | C#, or any code; how to write or read a script |
| "Click a thing, change its numbers in the Inspector" | How to create, save or organise a Unity project; packages; version control |
| Play mode, and that changes made in it vanish | Unity's real menus, keyboard shortcuts, docking, import settings |
| GameObjects made of Components; a Prefab is a master copy | Prefab overrides and variants in practice; scenes as files; loading a new scene |
| Rigidbody gravity, colliders and "is trigger" as ideas | Rigidbody settings, physics layers, collision matrices |
| Frame, game loop, and that `Update` runs every frame (as an idea) | Delta time, FixedUpdate, performance profiling |
| Sprite, sprite sheet, particles, sound effect as asset types | The Animator state machine, Shader Graph, lighting, 3D anything |
| Studio words: playtest, iterate, bug, feedback, Alpha/Beta | Project management, estimates, task boards, real QA process |

In one sentence: they walk in knowing *what the panels are for* and *what the words mean*, and they
still have to learn how to make Unity do it.

## 6. Old content that can seed concepts

This is mining material, not reuse as-is. It is all code-first, so the code parts get dropped. Live
lessons are in `app/content/lessons/`, and a person wrote them (CLAUDE.md: ask before touching).
Archive lessons are in `docs/archive/course-v1/`.

| Concept(s) | Seed | What's worth taking |
|---|---|---|
| Frame, game loop, engine | `lessons/what-an-engine-does.md` ("Read, update, draw"); `course-v1/the-game-loop.md`, `what-is-an-engine.md`, `tour-of-engines.md` | Read/update/draw is the loop wheel; the engine tour becomes "real world" cards |
| Gravity, collider | `lessons/physics-and-collision.md` ("Why games fake it", "When the fake breaks": tunnelling) | The S5 frame-step bug |
| Component, prefab | `lessons/entities-and-components.md` ("same thing, different parts", "adding a new kind for free") | The snap-on-parts shift |
| Event | `lessons/events-not-tangles.md` | The "announcing" idea behind when→then cards |
| Game state | `lessons/values-and-variables.md` (the numbers). Note: `lessons/game-state.md` is about *modes* (a state machine), which is a different idea and belongs in extra | The notebook of numbers |
| Core loop, mechanic, win/lose | `lessons/the-core-loop.md` (three parts; "the one-sentence test"); `course-v1/mechanics-rules-core-loop.md`, `ingredients-of-fun.md`, `challenge-add-a-fail-state.md`, `game-over-restart.md` | Loop cards; the no-lose version |
| Feedback, sound effect | `lessons/feedback.md` ("four ways to say that worked"), `lessons/sound-design.md` ("short, sharp, not annoying", "music sets the room") | Silent-coins lines; the mood pick |
| Juice, particles | `lessons/juice.md` ("how much is too much", "knowing when to stop"); `course-v1/what-is-juice.md` (juice vs rule quiz), `challenge-make-a-hit-feel-great.md`, `screen-shake-particles.md` | Juice board; S9 juice-or-rule sort |
| Sprite, animation frames | `lessons/what-a-game-is-made-of.md`, `lessons/sprites-and-animation.md` ("frames in a row", "speed changes everything") | Frame ordering; setting the animation speed |
| Difficulty curve | `lessons/difficulty-and-flow.md` ("the zone", "how Mario teaches you", "three dials") | Level-chunk ordering |
| Playtest, iterate | `course-v1/playtesting.md` ("don't explain, just watch"), `play-and-tinker.md` (change one thing) | The playtest rule, word for word |
| Bug, console | `lessons/reading-an-error.md` ("the message is not shouting at you", "four bugs you'll meet most") | S5 and S9 tickets |
| Roles (familiar) | `course-v1/people-behind-a-game.md`, `designers-programmers-artists.md`, `animators-sound-level.md`, `producers-and-qa.md`, `systems-of-a-game.md` | Their "who does this?" multiple-choice questions become "which department fixes this?" tickets |
| Launch, scope (familiar) | `lessons/ship-it.md`, `lessons/scope-and-cutting.md`; `course-v1/launch-your-game.md`, `cut-it-down.md` | S10 checklist; a producer teaser |

Nothing is worth keeping from `values-and-variables.md` syntax, `decisions-and-repeats.md`,
`data-out-of-code.md`, `why-javascript-phaser.md` or the `run` and `fillblank` code blocks. Those
teach code.

## Open questions for Jay

1. **26 owned and 32 familiar.** Is that the right cut? Music, Trigger and Asset were moved down to
   familiar to stay within budget. The silent-coins brief already treats sound effects as familiar;
   this map owns them so that Audio owns at least one word. Which should win?
2. **Late concepts.** Animation, particles and juice only reach the minimum number of returns. Would
   you rather have Art and Animation earlier (S4–S5) and Audio later?
3. **S1 and S2 go over the 2–3-term budget.** Should the first run stay as heavy as it is?
4. **Console.** Is it shown at all (`features.md` row 65)? If not, the Console is only met on a card.
5. **Order is fixed here, but the first run lets the kid pick a department.** Does the pick change
   only S1's second shift (this map's assumption), or the whole order? The director needs a rule.
6. **Door Problem at Beta (S8).** Is that the right place for it, or should it open the course?
7. **QA, Production and Publishing.** This map gives S9–S10 a preview of QA and Publishing. Is that
   too early, given "unlock later"?
8. **Who verifies the engine names** (every [unverified] above), and when? Before any card goes to
   kids.
