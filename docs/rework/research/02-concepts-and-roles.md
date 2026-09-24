# Transferable concepts, the roles, and an ordering

Research for the rework (`../00-direction.md`), 2026-09-24. Gathered by a research agent and kept
as returned, lightly edited.

**How reliable this is.** Fetching the official doc pages was blocked by the cloud network policy.
**(v)** = an official doc page appeared in search and its snippet confirmed the term. **(k)** = from
the agent's own knowledge, not checked this session — standard, stable names, but check before they
go into student materials. Role activities are the agent's own designs.

## 1. Transferable concept map

### 1a. Engine concepts

| Engine-neutral concept (kid phrasing) | Unity | Godot 4 | Unreal 5 |
|---|---|---|---|
| **Game loop** — "the game re-thinks every frame" | `Update()` / `FixedUpdate()` (k) | `_process(delta)` / `_physics_process(delta)` (v) | **Tick** / Event Tick (v) |
| **Scenes / levels** — "the rooms of your game" | **Scene** (v) | **Scene**, `change_scene_to_file` (v) | **Level / Map**; **World Partition** for big worlds (v) |
| **Things made of parts** | **GameObject + Components** (v) | **Node** tree; the node type is the ability (v) | **Actor + Components** (k) |
| **Templates** — "make one, stamp many" | **Prefab** (v) | **Scene instancing / PackedScene** (k) | **Blueprint Class** (k) |
| **Transform & coordinates** | Transform (k) | Node2D/3D position, Transform2D (k) | Location / Rotation / Scale (k) |
| **Sprites & animation states** — "idle → run → jump" | Sprite Renderer; **Animator Controller** states + transitions (v) | AnimatedSprite2D; **AnimationTree** state machine (v) | Paper2D **Flipbooks**; **Animation Blueprint state machines** (v) |
| **Physics bodies & colliders** | **Rigidbody 2D + Collider 2D** (v) | **CharacterBody2D, RigidBody2D, StaticBody2D, Area2D + CollisionShape2D** (v) | Collision components, Simulate Physics (k) |
| **Trigger zones** — "you walked into it" | Collider *Is Trigger* (k) | **Area2D** (v) | Trigger volumes / overlap events (k) |
| **Input mapping** — "Jump is an idea; Space is one key for it" | Input System **Actions / Action Maps** (v) | **InputMap** actions (v) | **Enhanced Input** actions + mapping contexts (v) |
| **Events** — "when X happens, tell Y" | C# events / UnityEvent (k) | **Signals** (v) | **Event Dispatchers** (v) |
| **State machines** (gameplay) | Animator or hand-rolled (k) | AnimationTree or hand-rolled (k) | **StateTree** (v) |
| **Cameras** | Camera + **Cinemachine** (v) | **Camera2D** (v) | CameraComponent + **Spring Arm** (v) |
| **UI / HUD** | UI Toolkit / uGUI Canvas (k) | Control nodes, CanvasLayer (k) | **UMG Widget Blueprints** (v) |
| **Particles & VFX** | **Particle System** / **VFX Graph** (v) | **GPUParticles2D / CPUParticles2D** (v) | **Niagara** (v) |
| **Audio & mixing** | AudioSource; **Audio Mixer** (v) | AudioStreamPlayer; **Audio buses** (v) | **MetaSounds**; Submixes (v) |
| **Game state & saving** | **PlayerPrefs** (v); ScriptableObjects (k) | Saving games guide (v); Autoloads (k) | **SaveGame** / SaveGameToSlot (v); GameMode/GameState (k) |
| **Spawning** | `Instantiate` a Prefab (v) | `instantiate()` a PackedScene (k) | SpawnActor (k) |
| **Enemy AI** | **NavMesh Agent** (v) | **NavigationAgent2D** (v) | **Behavior Tree + Blackboard**, StateTree (v) |
| **Version control** | **Unity Version Control** (v) | Git (k) | **Perforce** (v) |

**One phrasing works for all three engines:** *"a thing is built from parts, and you can save a thing
as a template to stamp copies."* (Unity and Unreal: an object with parts attached. Godot: a tree of
small nodes; a saved tree becomes a template.)

### 1b. Design concepts

| Concept | Kid phrasing | Source |
|---|---|---|
| **MDA** (Mechanics → Dynamics → Aesthetics) | "Rules make behaviour; behaviour makes feelings" | Hunicke, LeBlanc & Zubek 2004 (v) — https://users.cs.northwestern.edu/~hunicke/MDA.pdf |
| **Elemental tetrad** + **lenses** | "Four ingredients of every game; 100 questions to ask it" | Schell, *The Art of Game Design* (v, secondary) |
| **Core loop**, formal elements, **playtest → revise** | "What you do again and again" | Fullerton, *Game Design Workshop* (v) |
| **Win/lose conditions** | "How it ends" | Fullerton's "outcome" element (k) |
| **Game feel / juice** | "Make it *feel* good: shake, squash, sparkle, sound" | Swink, *Game Feel* (v); Jonasson & Purho, GDC Europe 2012 (v) — https://www.gdcvault.com/play/1016487/Juice-It-or-Lose |
| **Feedback** | "The game answers you" | Swink; Schell (k) |
| **Difficulty curve / flow** | "Not too easy, not too hard, a bit harder each time" | Csikszentmihalyi; Jenova Chen, "Flow in Games" (k) |
| **Level design** (teach, test, twist) | "Teach it safely, test it, then surprise them" | Nintendo's approach as described in GDC talks (k) |
| **Player motivation** | "Why do people keep playing?" | Self-Determination Theory (Rigby & Ryan, *Glued to Games*); Bartle types (k) |

## 2. The roles

Role descriptions informed by ScreenSkills games job profiles (v) —
https://www.screenskills.com/job-profiles/ — which also confirms QA is a common entry route into
design, animation and programming, and producers usually start as assistant producers.

| Role | What they do (for a 12-year-old) | Concepts they own | Industry tools | 10–20 min activity (AI helper, no code) |
|---|---|---|---|---|
| **Game designer** | Decides the rules and what makes it fun, then keeps changing them after watching people play. | Core loop, MDA, win/lose, difficulty, motivation | Docs, spreadsheets, Miro, the engine | **One-sentence game.** Verb + goal + threat; the AI builds it. Change *one* rule (gravity, speed, timer), play again, say which was more fun and why. |
| **Level designer** | Builds the places you play and decides where every jump, enemy and coin goes. | Levels, teach-test-twist, difficulty curve, camera framing | Engine editors, Tiled, paper maps | **Teach, test, twist.** Draw 3 short rooms on a tile grid: teach the jump safely, test it, twist it. The AI makes them playable; a partner plays. |
| **Gameplay programmer** | Turns the rules into instructions the computer follows, and hunts bugs. | Game loop, events, state machines, spawning, input | C#, C++, GDScript, Blueprints | **Be the computer.** Plain-English "when ___, then ___" rules for a coin, an enemy, the exit. The AI does *exactly* what was written; kids find the gaps ("you never said what happens at 0 lives") and fix the rules. |
| **2D/3D artist** | Draws what everything looks like and makes it all one world. | Sprites, readability, style, colour as information | Photoshop, Krita, Aseprite, Blender | **Silhouette test.** Draw or pick a hero and 2 enemies; black them out — can a friend tell who's who? Recolour so danger is one colour family. The AI swaps the art in. |
| **Animator** | Makes characters move so they feel alive. | Animation states & transitions, squash/stretch, anticipation | Aseprite, Spine, Blender; engine state machines | **Idle, run, jump.** 2–4 frame flipbooks per state; draw arrows for what triggers each change. The AI wires it up. Try with and without an anticipation frame. |
| **Technical artist** | The bridge between art and code: effects, tools, shaders, speed. | Particles/VFX, performance | Niagara, VFX Graph, Houdini | **Build an explosion.** Sliders (count, speed, lifetime, colour, gravity) for a coin sparkle and an explosion; then the same feel with half the particles. |
| **Sound designer / composer** | Makes the sounds and music and balances them. | Audio feedback, mixing, loops, juice | Reaper, FMOD, Wwise, MetaSounds | **Foley and mix.** Record or generate jump/coin/hurt sounds; 3 volume sliders (music/SFX/UI); play with sound off vs on. |
| **Narrative writer** | Writes the story, characters and every line of text, often in very few words. | Story, dialogue, world, onboarding text | Twine, Ink, articy:draft | **Six-word story.** Hero, want and villain in 6 words; 3 signs or NPC lines that teach a mechanic *without* instructions. The AI places them. |
| **UI/UX designer** | Designs menus, health bars and buttons so players are never confused. | UI/HUD, feedback, readability, accessibility | Figma, UMG, UI Toolkit | **Five-second HUD.** Sketch lives/score/timer; show a partner for 5 s — what did they notice? Redesign for colour-blindness. |
| **Producer** | Keeps the team on track: who does what, by when, what to cut. | Scope, milestones, iteration | Jira, Trello, spreadsheets | **Cut the list.** 12 feature cards, "10 minutes of work": choose 4 and plan. The AI "team" reports a delay: re-plan. |
| **QA / playtester** | Plays to break the game, then writes bug reports someone can fix. | Playtesting, iteration, reproduction | Jira, TestRail | **Bug bounty.** Play a deliberately buggy game; file 3 reports (steps, expected, actual). Watch a partner play yours silently and note where they get stuck. |
| *Extra:* **Creative director** | Holds the vision and says yes or no. | Pillars, coherence | — | **Three pillars.** 3 words the game must feel like; veto one idea that breaks them. |
| *Extra:* **Community / localisation** | Talks to players after launch; adapts for other languages. | Player feedback loop | Discord, analytics | **Write patch notes** for your own changes. |

## 3. Suggested ordering

Principle: a *playable* game by the end of session 1, and every later role visibly changes *their*
game. (→ = depends on.)

1. **Game designer — core loop + win/lose.** Verb + goal; the AI builds it. Instant "my game."
2. **Artist — sprites and style.** Quickest big visible change. (→ 1)
3. **Game feel / juice** (designer + sound + tech-art taster). Teaches **feedback** and **events**
   implicitly ("when coin collected → sparkle + sound"). (→ 2)
4. **Programmer — "when X, then Y" rules.** Events, game loop, spawning made explicit using the kid's
   own step-3 effects; **input mapping** here. (→ 3)
5. **Level designer — levels, templates, difficulty curve.** "Make one, stamp many" by stamping
   enemies and coins across 3 levels. (→ 4)
6. **Animator — animation states.** The first explicit **state machine**. (→ 2, 4)
7. **Enemy AI** (programmer + designer). The state machine reused: patrol → chase → return. (→ 6)
8. **Sound designer — full mix.** Music, buses, balance. (Could move earlier.)
9. **UI/UX + narrative.** HUD, title screen, signs that teach; **game state** and **saving**.
10. **QA / playtesting.** Swap games, file bugs, revise; **version control** as "save points for the
    whole project." (→ a finished loop)
11. **Producer + director capstone.** Scope, pitch, ship to classmates.

**Cross-cutting:** light playtesting in *every* session (Fullerton puts the playtest loop at the
core, not the end). **Camera** and **physics** come in as "dials" when a kid's game needs them, not
as fixed lessons.

## Sources

Engine docs (Unity, Godot, Unreal) — see the agent's list: Unity Prefabs, Scenes, Rigidbody 2D,
Animator Controller, Input System, Cinemachine, particles, Audio Mixer, PlayerPrefs, NavMesh Agent;
Godot processing, signals, InputMap, CharacterBody2D, AnimationTree, Camera2D, GPUParticles2D, audio
buses, saving games, NavigationAgent2D, changing scenes; Unreal ticking, Enhanced Input, state
machines, StateTree, Behavior Trees, Event Dispatchers, Niagara, MetaSounds, UMG, Spring Arm,
SaveGame, World Partition, Perforce. URLs:

- https://docs.unity3d.com/6000.5/Documentation/Manual/prefabs-introduction.html
- https://docs.unity3d.com/6000.3/Documentation/Manual/class-AnimatorController.html
- https://docs.unity3d.com/Packages/com.unity.inputsystem@1.8/manual/Actions.html
- https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html
- https://docs.godotengine.org/en/stable/tutorials/scripting/idle_and_physics_processing.html
- https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html
- https://dev.epicgames.com/documentation/en-us/unreal-engine/actor-ticking-in-unreal-engine
- https://dev.epicgames.com/documentation/en-us/unreal-engine/enhanced-input-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/overview-of-state-tree-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/event-dispatchers-in-unreal-engine

Design: MDA (link above); Fullerton —
https://www.routledge.com/Game-Design-Workshop-A-Playcentric-Approach-to-Creating-Innovative-Games/Fullerton/p/book/9781032607009;
Swink — https://en.wikipedia.org/wiki/Game_feel; Juice It or Lose It (link above).

Roles: https://www.screenskills.com/job-profiles/ and the games career map
https://www.screenskills.com/media/xskl5wdb/2756-games-career-map-interactive-feb25-final.pdf

**Gaps:** no IGDA or studio job-ad sources; no ScreenSkills profiles found for sound designer or UX
designer; tool lists per role are from knowledge.
