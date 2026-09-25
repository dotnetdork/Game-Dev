# The game industry, concept by concept: a comprehensive inventory for a no-code studio course

Research for the rework, 2026-09-25. Extends `docs/rework/research/02-concepts-and-roles.md` (which
gave a 19-row engine map and 11 roles). This file is the full inventory: ~315 concept and role rows across 8
domains, each with engine names, a tier, a kid definition, an "aha" moment and prerequisites.

**Audience assumed.** Ages 10–13, new to computers, no code, no syntax. The course is a game: the
kid is the new hire at a studio; an AI mentor and studio characters hand out quests. The target is
*recognition years later*: "oh, that's the Inspector", "that's a frame", "that's what a tech artist
does".

## How to read this

**Reliability labels.**
- **[vs]** = verified-snippet: an official or authoritative page appeared in a web search this
  session and its snippet confirmed the claim. Direct page fetches were blocked by the network
  proxy (docs.godotengine.org returned `EGRESS_BLOCKED`), so nothing here is "fetched".
- **[k]** = knowledge: from the researcher's own knowledge, not checked this session. The engine
  names marked [k] are long-stable, but check them before they go into student-facing text.
- Unlabelled cells in the big tables are the researcher's own teaching designs (definitions, aha
  moments, tiers) and are opinions, not facts.

**Columns.**
- **ID** — used for prerequisites (`needs`). E = Engine/editor, T = Technical, D = Design, A = Art &
  animation, S = Sound, P = Production, R = Roles, B = Business.
- **Unity · Unreal · Godot** — the name each engine uses, in that order. "—" = no direct equivalent.
  Unity = Unity 6, Unreal = UE 5.x, Godot = 4.x unless stated.
- **Tier** — **C** = Core (every kid leaves with it), **I** = Important, **X** = Extra (keen kids).
- **Kid definition** — one sentence, aimed at a 6th-grade reading level.
- **Aha** — one playable/interactive browser moment, no code, that makes the kid *feel* the idea.
- **Needs** — concepts that should come first.

---

## Domain 1 — The engine and the editor

### 1.0 Panel-name crosswalk (verified where possible)

This is the table a kid should half-remember in a Unity/Unreal/Godot course. The course's own UI
should use the **engine-neutral name** as the label and show the three real names on hover or in a
"In the real world…" card.

| Neutral name (use in course) | Unity | Unreal Engine 5 | Godot 4 | Evidence |
|---|---|---|---|---|
| **World view** (where you build) | **Scene view** | **Level Viewport** | **2D / 3D main screen** (the viewport in the 2D or 3D workspace) | Unity [vs] (Unity Learn "Explore the Editor Interface"; Manual "Unity's interface"); Unreal [vs] ("Unreal Editor Interface", "Level Editor"); Godot [vs] (Kodeco/DEV tutorials; official "First look at Godot's interface" page title only) |
| **Play view** (the game as the player sees it) | **Game view** + **Play mode** | **Play In Editor (PIE)** in the viewport or a new window; **Simulate** | Runs in a separate window (F5 / F6); Godot 4.4+ can embed it in a **Game** workspace [k] | Unity [vs] (Manual "Game view reference"; Toolbar: "Play… Pause… Step moves Play mode forward by one frame"); Unreal [vs] ("Playing and Simulating", "In-Editor Testing (Play & Simulate)"); Godot F5 Run Project / F6 Run Current Scene [vs] (Godot issue tracker, shortcuts pages) |
| **Object list** (everything in this level) | **Hierarchy** window | **Outliner** (was "World Outliner" in UE4 [k]) | **Scene** dock (the scene tree); **Remote** tab while running | Unity [vs] (Manual "Hierarchy window"); Unreal [vs] ("Outliner panel displays a hierarchical view of all content in your level"); Godot [vs] ("Scene Dock … shows a hierarchy of the nodes"; Remote tab snippet) |
| **Settings panel** (the knobs of the selected thing) | **Inspector** window | **Details** panel | **Inspector** dock | Unity [vs] (Manual "The Inspector window"); Unreal [vs] ("Level Editor Details Panel"); Godot [vs] (docs page "Inspector Dock") |
| **Project shelf** (every file in the project) | **Project** window | **Content Browser** / **Content Drawer** (Ctrl+Space) | **FileSystem** dock | Unity [vs]; Unreal [vs] ("Content Browser in Unreal Engine"; Content Drawer "is a special instance of the Content Browser"); Godot [vs] (FileSystem dock snippets) |
| **Message log** (what the engine tells you, errors) | **Console** window | **Output Log** (+ Message Log) | **Output** panel (+ **Debugger** panel) | Unity [k]; Unreal [vs] ("Bottom Toolbar contains shortcuts to the Command Console, Output Log"); Godot [vs] ("The 'Output' or 'Debugger' tabs at the bottom are where Godot tells you about errors") |
| **Asset shop** | **Asset Store** (opened via Package Manager) | **Fab** (replaced Unreal Marketplace, Oct 2024; Fab window in editor) | **AssetLib** workspace; new **Godot Asset Store** integrated in 4.7 | Unity [vs] (Manual "Unity's Asset Store"); Unreal [vs] (Epic blog "Fab… launches today"; docs "Fab Window in Unreal Engine"); Godot [vs] ("About the Asset Library"; godotengine.org "Introducing the Godot Asset Store") |
| **Add-a-thing menu** | GameObject menu / right-click in Hierarchy | **Place Actors** panel / Quick Add | **Add Child Node** (Ctrl+A) in the Scene dock [k] | Unreal [vs] ("Placing Actors in Unreal Engine") |
| **Play / Pause / Step buttons** | Toolbar **Play · Pause · Step** | Main toolbar **Play** (dropdown: Simulate, New Window…), **Pause**, **Stop**, frame advance while paused [k] | **Run Project (F5) · Run Current Scene (F6) · Pause · Stop** | Unity [vs]; Unreal [vs] (PIE via Play button, SIE via dropdown Alt+S); Godot [vs] |
| **Move / Turn / Resize tools** | **Move (W) · Rotate (E) · Scale (R) · Rect (T)**, + combined Transform tool | **Translate (W) · Rotate (E) · Scale (R)** [k] | **Move (W) · Rotate (E) · Scale (R)**, Select (Q) [k] | Unity [vs] (Manual "Position GameObjects": "W for Move, E for Rotate, R for Scale and T for RectTransform") |
| **Template** ("make one, stamp many") | **Prefab** (+ Prefab Variant) | **Blueprint Class** (+ child Blueprint); Level Instance / Packed Level Actor [k] | **Scene** saved and **instanced** (+ inherited scene) | from 02 file [vs]/[k] |
| **Thing** / **part** | **GameObject** + **Component** | **Actor** + **Component** | **Node** (a tree of nodes) | from 02 file |
| **Labels & groups** | **Tags** and **Layers** | **Actor Tags**; **Collision Channels** | **Groups**; physics layers/masks [k] | Unity [vs] (Manual "Tags and Layers": tags identify, layers opt groups in/out of rendering, lighting, physics); Godot [vs] ("Groups in Godot work like tags"); Unreal [vs] (forum: 32 collision channels) |
| **Make the real game file** | **Build Profiles** (File > Build Profiles; replaced Build Settings in Unity 6) | **Package Project** (Platforms menu) | **Export** (Project > Export; needs **export templates**) | Unity [vs] ("Build Settings have been overhauled into Build Profiles in Unity 6"); Unreal [vs] ("Packaging Your Project"); Godot [vs] ("Exporting projects"; export templates "compiled for each target platform") |
| **Project settings** | Project Settings | Project Settings (+ World Settings per level) | Project Settings | [k] |
| **Instructions / script** | C# **script** (component) | **Blueprint** graph (visual) or C++ | **GDScript** (or C#) attached to a node | [k] |

**Recommendation.** The three concepts with the biggest recognition payoff are *Object list*,
*Settings panel* and *Project shelf*: every engine has them, positioned in roughly the same places
(list left or top-right, settings right, files bottom). If the course's own editor places them the
same way — list on the left, settings on the right, shelf along the bottom, world view in the middle,
Play button at the top — kids will get the spatial memory for free.

### 1.1 Editor concepts

| ID | Concept | Unity · Unreal · Godot | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|---|
| E1 | **Game engine** | Unity · Unreal Engine · Godot | C | A game engine is a giant toolbox that already knows how to draw, play sounds and do physics, so you can spend your time on *your* game. | Mentor shows the same bouncing ball "made from scratch" (100 steps) vs "in the engine" (drag ball, tick Gravity). | — |
| E2 | **Editor** vs **the game** | Unity Editor · Unreal Editor · Godot editor | C | The editor is the workshop where you build; the game is what players get — they never see the workshop. | A curtain drops: "Player view" hides every panel, leaving only the game. | E1 |
| E3 | **Project** | Project · Project (.uproject) · Project (project.godot) | C | A project is one game's folder: every picture, sound, level and setting for it lives together. | Kid's first quest creates "MyFirstGame" and sees an empty shelf fill as they import things. | E1 |
| E4 | **World view / viewport** | Scene view · Level Viewport · 2D/3D workspace | C | The world view is your building table, where you drag things around to set up a level. | Drag a coin from the shelf into the world view; it appears at the spot you dropped it. | E3 |
| E5 | **Play mode / play-testing in the editor** | Game view, Play mode · Play In Editor (PIE) · Run (F5/F6) | C | Pressing Play turns your building table into a real game so you can try it instantly. | Build, press ▶, play, press ■ — and everything snaps back to how you built it. | E4 |
| E6 | **Play-mode changes don't stick** | Play-mode changes revert · "Keep Simulation Changes" option · edits in Remote tree don't save | I | Changes you make *while* the game is playing vanish when you stop — a classic beginner trap. | Mentor lets the kid recolour the hero during Play, then stop; it's back to blue. "Every pro has done this." | E5 |
| E7 | **Object list / hierarchy** | Hierarchy · Outliner · Scene dock (scene tree) | C | The object list names every single thing in your level, like a class register. | Click a name in the list and the thing lights up in the world, and vice-versa. | E4 |
| E8 | **Settings panel / inspector** | Inspector · Details panel · Inspector dock | C | The settings panel shows all the knobs for whatever you clicked — size, colour, speed, bounciness. | Click the enemy; drag its "speed" knob from 2 to 10 in the panel and watch it zoom. | E7 |
| E9 | **Properties / values** | Fields/properties · Properties/variables · Properties (exported vars) | C | A property is one knob on a thing, like "jump height = 5". | Two identical frogs; kid changes only one property ("jump 3 → 9") and they're now different frogs. | E8 |
| E10 | **Project shelf / asset browser** | Project window · Content Browser / Content Drawer · FileSystem dock | C | The project shelf holds all your game's files, sorted into folders, ready to drag into the world. | A messy shelf of 40 files; kid sorts into Art / Sound / Levels folders and then finds "jump.wav" in 3 seconds. | E3 |
| E11 | **Asset** | Asset · Asset · Resource | C | An asset is any ingredient for your game — a picture, a sound, a 3D model, a level. | "Ingredient hunt": tick which of 10 things are assets (picture ✓, sound ✓, the Play button ✗). | E10 |
| E12 | **Importing** | Import (drag into Project) · Import (into Content Browser) · Import (drop into FileSystem, .import settings) | I | Importing is bringing a file into your project so the engine can use it. | Drag a drawing from "your desktop" into the shelf; a progress bar, then it's usable. | E11 |
| E13 | **Message log / console** | Console · Output Log · Output + Debugger | C | The message log is where the engine talks to you — "all good", warnings, and red error messages. | A broken door; the log says "Door has no key assigned." Kid reads it and fixes it in the settings panel. | E5 |
| E14 | **Errors vs warnings** | Error (red) / Warning (yellow) · Error / Warning · Error / Warning | I | Red means "something is broken"; yellow means "this might cause trouble later". | Sort 6 log messages into "fix now" and "keep an eye on". | E13 |
| E15 | **Asset store** | Asset Store · Fab · AssetLib / Godot Asset Store | I | The asset store is a shop (lots of it free) where people share art, sounds and tools for games. | The studio "supply closet": pick a free tree pack; check its licence card before using it. | E11, S14 |
| E16 | **Transform tools (move/rotate/scale)** | Move/Rotate/Scale (W/E/R) · Translate/Rotate/Scale (W/E/R) · Move/Rotate/Scale (W/E/R) | C | Move, turn and resize are the three tools you'll use a thousand times to place things. | Three buttons + keyboard W/E/R; a "put the crates in the outlines" puzzle. | E4, T20 |
| E17 | **Gizmo / handles** | Gizmos, handles · Transform widget/gizmo · Gizmos | I | A gizmo is the coloured arrows or rings that pop up so you can grab and move things. | Drag only the red arrow and the crate can only slide left-right. | E16 |
| E18 | **Snapping / grid** | Grid snapping, increment snap · Grid snap, rotation snap · Grid snap / Use Snap | I | Snapping makes things jump neatly to a grid so your walls line up perfectly. | Build a wall with snap off (gappy) then on (perfect). | E16 |
| E19 | **Navigating the view** (pan, zoom, orbit, focus) | Hand tool, flythrough (RMB+WASD), F = Frame Selected · RMB+WASD, F = focus · Pan/zoom, F = focus (3D) | I | You can fly your editor camera around the world without moving anything in the game. | "Find the lost cat" in a big level: pan, zoom, then press F on the cat's name to zoom right to it. | E4 |
| E20 | **Thing / object** | GameObject · Actor · Node | C | Everything in a level — the player, a coin, a wall, even the camera — is a thing. | Kid clicks through the list: "Is the camera a thing? Is the sky a thing?" — yes, yes. | E7 |
| E21 | **Parts / components** | Components · Components · Nodes (children) | C | A thing does stuff because of the parts you snap onto it, like Lego pieces. | A plain box; snap on "Gravity" (it falls), "Collider" (lands on the floor), "Bouncy" (bounces). | E20 |
| E22 | **Parent and child** | Parent/child in Hierarchy · Attach Actor to parent / component hierarchy · Parent/child nodes | C | When one thing is inside another, the child goes wherever the parent goes. | Put a hat on the knight (make it a child); move the knight; the hat follows. Un-child it; hat stays behind. | E7, E16 |
| E23 | **Template ("make one, stamp many")** | Prefab · Blueprint Class · Instanced scene (PackedScene) | C | A template is a master copy: stamp out 50 enemies, then change the master and all 50 change. | Stamp 20 goombas; make the template red; all 20 turn red at once. | E21 |
| E24 | **Instance vs template / overrides** | Prefab instance + overrides · Blueprint instance, per-instance properties · Instance + "Editable Children" / overridden properties | I | Each stamped copy can have its own small changes without breaking its link to the master. | Make one goomba giant (override); change the master's colour; the giant turns red too but stays giant. | E23 |
| E25 | **Variants / inheritance** | Prefab Variant · Child Blueprint Class · Inherited scene | X | A variant is "the same as that one, except…" — a fire goomba is a goomba with one change. | Make "Ice Goomba" from Goomba: change only colour and speed; improve Goomba's jump and Ice Goomba gets it too. | E24 |
| E26 | **Scene / level** | Scene · Level (Map) · Scene | C | A level is one "room" of your game, saved on its own, like a chapter of a book. | Build level 1; door leads to level 2; the list and world view change completely. | E4 |
| E27 | **Loading a new level** | SceneManager.LoadScene · Open Level · change_scene_to_file | I | Going through a door can swap the whole world for a new level. | Kid sets "When player touches door → go to Level 2" in a trigger's settings. | E26, T28 |
| E28 | **Tags / groups** | Tags · Actor Tags · Groups | I | A tag is a sticky label like "Enemy" or "Coin" so the game can find all of those at once. | "Freeze everything tagged Enemy" button — tag 3 things, press, only those freeze. | E20 |
| E29 | **Layers (drawing and collision layers)** | Layers, Sorting Layers · Collision Channels, render layers · Physics layers/masks, CanvasItem z_index / visibility layers | I | Layers decide what gets drawn on top and what can bump into what. | Ghost hero on its own layer walks through walls but still collects coins. | E28, T25 |
| E30 | **Scripts / behaviours** (recognise, not write) | C# script · Blueprint / C++ · GDScript | I | A script is written instructions you attach to a thing to give it a brain. | Mentor shows a "when touched → add 1 point" card attached to a coin like a component. | E21, T27 |
| E31 | **Visual scripting** | Visual Scripting · Blueprints (Event Graph) · — (VisualScript removed in 4.0 [k]) | X | Visual scripting is coding with boxes and wires instead of typed words. | Connect "On touch" → "Play sound" → "Destroy" boxes with wires; it works. | E30 |
| E32 | **Project settings** | Project Settings · Project Settings · Project Settings | I | Project settings are the rules for the whole game, like screen size and which keys do what. | Change the game window from wide to phone-tall and see every level reshape. | E3 |
| E33 | **Input map (actions)** | Input System Actions · Enhanced Input Actions / Mapping Contexts · Input Map | I | The input map says "Jump" is an idea, and Space, the A button or a tap are all ways to do it. | Kid adds "W" as a second jump key in a map screen, then plays using W. | T31, E32 |
| E34 | **Editor modes / workspaces** | Scene/Game/Animation windows · Modes (Select, Landscape, Foliage, Modeling…) · 2D / 3D / Script / Game / AssetLib | X | The editor has different rooms for different jobs — building, animating, writing scripts. | Tabs at the top switch "Build / Animate / Sound" rooms in the course editor. | E4 |
| E35 | **Tilemap editor** | Tilemap + Tile Palette · Paper2D Tile Map (plugin) [k] · TileMapLayer + TileSet [k] | I | A tilemap lets you paint a level with square tiles like colouring on graph paper. | Paint grass, dirt and water tiles; the painted water is instantly un-walkable. | E4, A12 |
| E36 | **Terrain / landscape tool** | Terrain · Landscape mode · — (add-ons) [k] | X | A terrain tool lets you sculpt hills and valleys like clay and paint grass on them. | Brush up a hill, paint snow on its peak (3D demo). | E34, T11 |
| E37 | **Animation editor / timeline** | Animation window + Animator · Sequencer, Animation Editor · AnimationPlayer (Animation panel) | I | The animation timeline is where you set what something looks like at each moment. | Drag the playhead: the door creaks open frame by frame. | A15 |
| E38 | **Material / shader editor** | Shader Graph · Material Editor · Visual Shader / ShaderMaterial | X | A material editor is a recipe book for how surfaces look — shiny, rough, glowing, wobbly. | Slide "shiny" and "glow" on a coin; watch it change. | T13 |
| E39 | **Profiler** | Profiler · Unreal Insights, `stat fps` [k] · Debugger > Profiler / Monitors | X | The profiler is a speedometer that shows what's making your game slow. | Add 5,000 fireflies; the frame-time graph spikes red; delete half; it calms. | T3, T40 |
| E40 | **Debugger / pausing and stepping** | Pause + Step, breakpoints · Pause, Advance single frame, Blueprint breakpoints · Pause, breakpoints, Remote tree | I | You can freeze the game and move it forward one frame at a time to catch a bug in the act. | A bullet passes through a wall; kid pauses and steps frame by frame to see it "jump over" the wall. | E5, T1, T29 |
| E41 | **Undo / history** | Undo History · Undo History · History dock [k] | C | Undo is a time machine for your mistakes — try anything, you can always go back. | Delete the whole level, press Undo, it's back. "Be brave." | E4 |
| E42 | **Save the project** | Save / Save Project · Save All · Save Scene | C | Saving writes your work to disk; the engine does not always save for you. | A fake "power cut" after 2 minutes unsaved; the mentor restores it once and teaches Ctrl+S. | E3 |
| E43 | **Packages / plugins / add-ons** | Package Manager · Plugins · Add-ons (AssetLib) | X | A plugin is an extra tool you can add to the engine, like an app on a phone. | Toggle a "Weather" plugin on; a Rain component appears in the parts list. | E15 |
| E44 | **Build / export** | Build Profiles · Package Project · Export (+ export templates) | C | Building turns your project into a real game file anyone can play without the editor. | "Ship it" button produces a link a friend can open; the editor panels are gone. | E3, T46 |
| E45 | **Target platform** | Build Profiles per platform · Platforms menu · Export presets | I | Before building, you choose where it will run: computer, phone, console or web. | Build the same game for "phone" — the controls turn into touch buttons. | E44, B1 |
| E46 | **Docking / layout** | Window layouts · Tabs & layouts · Docks | X | You can drag panels around to make the editor comfortable, and reset it if you make a mess. | Drag the settings panel to the left; "Reset layout" puts it back. | E4 |

---

## Domain 2 — How games work (technical, no code)

### 2.1 Time: frames and the loop

| ID | Concept | Unity · Unreal · Godot | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|---|
| T1 | **Frame** | Frame · Frame · Frame | C | A frame is one still picture; a game shows lots of them every second so it looks like it moves — like a flipbook. | A "slow-mo dial": drag it down to 1 frame per second and watch the game become a slideshow of still pictures. | — |
| T2 | **Frame rate / FPS** | Frame rate · Frame rate (`stat fps`) · FPS (Engine.get_frames_per_second) [k] | C | FPS (frames per second) is how many pictures the game draws each second — 60 feels smooth, 10 feels choppy. | Same game side by side at 60, 30, 15 and 5 FPS; kid picks which they'd want to play. | T1 |
| T3 | **Lag, stutter and frame drops** | — | C | When the computer can't draw frames fast enough, the game stutters — that's a frame drop. | Add 10,000 raindrops; an FPS counter drops from 60 to 12 and the hero starts jerking. | T2 |
| T4 | **The game loop** | Update() / FixedUpdate() · Tick · _process / _physics_process | C | Every frame the game does the same three things: check the buttons, update everything, draw the picture — over and over. | A spinning "loop wheel" with 3 slots (Listen → Think → Draw) lights up in time with the game; slow it down to see each step. | T1 |
| T5 | **Delta time** | Time.deltaTime · DeltaSeconds · delta | I | Delta time is "how long since the last frame", so things move the same speed on fast and slow computers. | Two racers on a "fast PC" and a "slow PC": without delta time the slow-PC racer loses; switch it on and they tie. | T2, T4 |
| T6 | **Fixed step (physics tick)** | FixedUpdate · physics sub-stepping [k] · _physics_process | X | Physics ticks at a steady beat, separate from drawing, so collisions stay reliable. | Metronome for physics next to a jittery draw counter; the ball still bounces the same. | T5, T21 |
| T7 | **Pause** (in the game) | Time.timeScale = 0 · Set Game Paused · get_tree().paused | I | Pausing tells the game loop to stop updating the world but keep drawing the menu. | Pause button that freezes enemies but the pause-menu buttons still wiggle. | T4 |
| T8 | **Timers** | Coroutines / timers · Timers (Set Timer by Event) · Timer node | I | A timer counts down and then makes something happen, like a bomb fuse. | Set a 3-second fuse on a crate in its settings panel; press Play; boom. | T4 |
| T9 | **Time scale / slow motion** | Time.timeScale · Global Time Dilation · Engine.time_scale | X | Time scale is a dial that makes the whole game run in slow motion or fast-forward. | "Bullet-time" slider in a dodgeball level. | T5 |

### 2.2 Pictures on screen

| ID | Concept | Unity · Unreal · Godot | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|---|
| T10 | **Pixel** | Pixel · Pixel · Pixel | C | A pixel is one tiny coloured square; your screen is made of millions of them. | Zoom into the hero until you see the squares; colour one pixel and zoom back out to spot it. | — |
| T11 | **Resolution & aspect ratio** | Resolution, Game view aspect · Resolution · Viewport size, stretch mode | I | Resolution is how many pixels wide and tall the picture is; aspect ratio is its shape (wide or tall). | Toggle the same level between TV (wide), phone (tall) and 8-bit tiny resolutions. | T10 |
| T12 | **Rendering** | Rendering / render pipeline (URP/HDRP) · Rendering (Lumen, Nanite) · Rendering (Forward+, Mobile, Compatibility) | C | Rendering is the computer painting the picture of the game world, from scratch, every frame. | "Paint by frame": watch a frame drawn layer by layer — sky, hills, player, sparkles, UI — in slow motion. | T1, T10 |
| T13 | **Draw order / layers / z-order** | Sorting Layer / Order in Layer · Translucency sort priority · z_index, CanvasLayer | I | Draw order decides what's painted on top — whatever is drawn last covers the rest. | Hero keeps vanishing behind a bush; kid drags the hero's layer above the bush. | T12 |
| T14 | **Sprite** | Sprite / Sprite Renderer · Paper2D Sprite · Sprite2D | C | A sprite is a flat picture used as a character or object in a 2D game. | Drag a new sprite onto the hero; the whole game suddenly stars a cat. | T10 |
| T15 | **Texture** | Texture · Texture · Texture2D | I | A texture is a picture wrapped onto a surface, like wrapping paper on a box. | Wrap brick, wood and candy-stripe pictures onto the same 3D crate. | T14, T16 |
| T16 | **Mesh, polygons, vertices** | Mesh · Static Mesh / Skeletal Mesh · Mesh (MeshInstance3D) | I | A 3D model is a shell made of flat triangles joined at corner points called vertices. | "Wireframe goggles" toggle turns a smooth dragon into its triangle net; slider from 20 to 2,000 triangles. | T12 |
| T17 | **Material** | Material · Material · Material (StandardMaterial3D) | I | A material says what a surface is *like* — shiny metal, soft cloth, glowing lava. | Same ball, three material swatches: metal, rubber, lava; lights change how each one looks. | T15 |
| T18 | **Shader** | Shader / Shader Graph · Material graph (shaders) · Shader (.gdshader) / Visual Shader | X | A shader is a tiny program that decides the colour of every pixel — used for water ripples, toon outlines and glow. | Slider-driven "wobble", "outline" and "dissolve" effects on the hero. | T17 |
| T19 | **Lighting and shadows** | Lights (Directional, Point, Spot), baked/realtime · Lights, Lumen · DirectionalLight3D, OmniLight3D, SpotLight3D, PointLight2D | I | Lights decide what's bright, what's dark and where shadows fall — they set the mood. | Same room at noon, sunset and torch-lit night by dragging one sun slider and placing a torch. | T12 |
| T20 | **Coordinates (x, y, z) and the origin** | Transform.position · Location · position | C | Every thing's position is a pair (or trio) of numbers: how far across (x), up/down (y) and, in 3D, deep (z). | "Battleship" treasure hunt: the mentor says "dig at x 5, y 3"; kid clicks there. Then a surprise: in many 2D engines y goes *down* the screen. | — |
| T21 | **Transform (position, rotation, scale)** | Transform · Transform (Location/Rotation/Scale) · Transform2D / Transform3D | C | A thing's transform is its where, which-way and how-big. | Three sliders in the settings panel move, spin and grow a crate. | T20 |
| T22 | **2D vs 3D (and 2.5D)** | 2D/3D project templates · (3D-first; Paper2D for 2D) · separate 2D and 3D node families | C | 2D games are flat like a drawing; 3D games have depth you can walk around in; 2.5D is 3D that plays flat. | The same level flips from flat side-view to a rotatable 3D diorama with one toggle. | T20 |
| T23 | **Camera** | Camera (+ Cinemachine) · Camera Component, Spring Arm · Camera2D / Camera3D | C | The camera is the player's eye — only what it sees ends up on screen. | Kid drags a camera rectangle around the world; the "player view" window shows only what's inside it. | T12 |
| T24 | **Camera follow, deadzone, perspective vs orthographic** | Cinemachine follow/deadzone; Projection · Spring Arm, lag; Projection · Camera2D smoothing, drag margins; projection | I | A good camera follows smoothly, lets you see ahead, and in 3D can make far things look smaller (perspective) or not (orthographic). | Try "locked", "smooth" and "look-ahead" follow modes in a platformer; vote which feels best. | T23 |
| T25 | **Culling, LOD, draw calls** (performance of drawing) | Frustum/occlusion culling, LOD Group · culling, HLOD, Nanite · VisibleOnScreenNotifier, visibility ranges | X | The game skips drawing what you can't see and uses simpler models far away, so it runs fast. | Fly a camera over a forest with a "show what's being drawn" overlay: trees behind you blink off. | T16, T3 |
| T26 | **Post-processing** | Volume / Post-processing · Post Process Volume · WorldEnvironment / Environment | X | Post-processing is a filter on the finished picture — glow, blur, colour tints — like a photo app filter. | Toggle bloom, vignette and "old film" filters over the same level. | T12 |

### 2.3 Brains: rules, state, events

| ID | Concept | Unity · Unreal · Godot | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|---|
| T27 | **Variables / game state** (the numbers a game remembers) | Fields, ScriptableObjects · Variables, GameState/PlayerState · Variables, Autoloads | C | The game keeps a notebook of numbers — score, lives, coins, time left — and changes them as you play. | A live "notebook" panel shows score/lives/timer ticking as the kid plays; they type 99 into lives and become invincible. | T4 |
| T28 | **Events / triggers ("when X, then Y")** | C# events, UnityEvent, OnTriggerEnter · Event Dispatchers, Begin Overlap · Signals, body_entered | C | An event is the game noticing something happen — "the player touched the lava" — and reacting. | Card builder: WHEN [player touches] [spike] THEN [lose a life] [play ouch]. Play it. | T27 |
| T29 | **Bugs, glitches and crashes** | — | C | A bug is when the game does something the makers didn't mean; a crash is when it stops completely. | "Bug zoo": 5 short clips (falling through the floor, a T-posing hero, a frozen screen) — kid names bug vs crash vs design choice. | T4 |
| T30 | **State machine** | Animator states / hand-rolled · StateTree, Anim state machines · AnimationTree / hand-rolled | I | A state machine is a map of moods a thing can be in (idle, walking, jumping) and arrows for what switches them. | Draw arrows between Idle, Run and Jump bubbles; the hero obeys exactly — and gets stuck if an arrow is missing. | T28 |

### 2.4 Movement, physics, collisions

| ID | Concept | Unity · Unreal · Godot | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|---|
| T31 | **Input** (keys, mouse, touch, controller) | Input System · Enhanced Input · Input / InputEvent | C | Input is everything the player does to talk to the game: keys, clicks, taps and buttons. | A controller diagram lights up as the kid presses keys; each key is wired to an action. | T4 |
| T32 | **Input feel: responsiveness, input lag, buffering, coyote time** | — (design technique, not engine features) | X | Good games forgive you: a jump pressed just *before* landing or just *after* leaving a ledge still counts. | Toggle "coyote time" on and off on a tricky ledge; kid's success rate jumps. | T31, D10 |
| T33 | **Physics (gravity, velocity, mass, friction, bounce)** | Rigidbody, Physics Material · Simulate Physics, Physical Material · RigidBody, PhysicsMaterial | C | Physics is the game pretending to obey real-world rules like gravity, speed and bounciness. | Sliders for gravity (moon ↔ Jupiter), friction (ice ↔ glue) and bounce on a playground. | T21 |
| T34 | **Body types: dynamic, kinematic, static** | Rigidbody Dynamic / Kinematic / Static · Simulate Physics on/off, Movable/Static mobility · RigidBody / CharacterBody / StaticBody | X | Some things are pushed around by physics (a ball), some move only when told (the player, a lift), and some never move (the floor). | Toggle a crate between "dynamic" (knocked over), "kinematic" (plows through everything) and "static" (won't budge). | T33 |
| T35 | **Collider / hitbox** | Collider (Box/Circle/Capsule…) · Collision component (Box/Sphere/Capsule) · CollisionShape2D/3D | C | A collider is an invisible shape around a thing that the game uses to tell when it touches something. | "Show hitboxes" toggle reveals green boxes; make the spike's box too big and feel the unfair death. | T33 |
| T36 | **Hitbox vs hurtbox** | — (fighting/action game convention) | X | A hitbox is the part that hurts others (the sword); a hurtbox is the part that can get hurt (the body). | Shrink the sword's hitbox until attacks whiff; see why fighting-game fans argue about boxes. | T35 |
| T37 | **Trigger zone / overlap area** | Collider with Is Trigger · Trigger Volume / overlap events · Area2D / Area3D | C | A trigger is an invisible zone that notices when you walk in — to open a door, start music or save your game. | Draw a zone by the door; set "on enter → door opens"; walk in. | T35, T28 |
| T38 | **Collision tunnelling** | Continuous collision detection · CCD · continuous_cd | X | Things moving very fast can skip right through thin walls between two frames. | Speed a bullet up until it passes through a wall; step frames (E40) to see it jump over. | T35, T1 |
| T39 | **Raycast / line trace** | Physics.Raycast · Line Trace · RayCast2D / RayCast3D | I | A raycast is an invisible laser the game shoots to ask "what's in that direction?" — for aiming, line-of-sight and ground checks. | Turn on "show lasers" for a guard: it only chases you if its laser reaches you, not through walls. | T20, T35 |

### 2.5 Everything else a game does

| ID | Concept | Unity · Unreal · Godot | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|---|
| T40 | **Performance and the frame budget** | Profiler · Unreal Insights · Profiler / Monitors | I | To hit 60 FPS the computer has only 16 milliseconds to do everything each frame — that's the frame budget. | A "budget bar" fills as you add enemies, particles and lights; past the line, the game stutters. | T2, T3 |
| T41 | **CPU, GPU and memory** | — | X | The CPU is the game's brain, the GPU is its painter, and memory is its desk space. | Three gauges; spawn 1,000 smart enemies (CPU climbs) vs 1,000 sparkles (GPU climbs). | T40 |
| T42 | **Spawning (and destroying)** | Instantiate / Destroy · SpawnActor / DestroyActor · instantiate() / queue_free() | C | Spawning makes a new thing appear mid-game (a bullet, an enemy); destroying removes it. | A spawner machine drops coins every second; set "destroy after 5s" or the level floods. | E23, T28 |
| T43 | **Object pooling** | ObjectPool · (manual pooling) [k] · (manual pooling) [k] | X | Pooling reuses old bullets instead of making new ones, like washing cups instead of buying more. | Counter: "bullets made" climbs forever vs stays at 20 with pooling on; FPS stays higher. | T42, T40 |
| T44 | **Randomness / RNG and seeds** | Random · Random Stream · RandomNumberGenerator | I | RNG is the game's dice roll; a seed is a code that makes the "random" rolls come out the same every time. | Generate a random dungeon; type the same seed as a friend and get the *identical* dungeon. | T27 |
| T45 | **Procedural generation** | — (technique; Unreal PCG framework [vs] mentioned in job ads) | I | Procedural generation is the game building levels or worlds by itself using rules and dice. | Sliders for "rooms", "twistiness" and "treasure" regenerate a dungeon each click. | T44 |
| T46 | **Loading and streaming** | Async scene loading, Addressables · Level Streaming, World Partition · ResourceLoader threaded loading | X | Loading brings the next level into memory; big open worlds load pieces in as you walk so you never see a loading screen. | Walk across a map with a "loaded chunks" overlay: tiles appear ahead and vanish behind. | T41, E26 |
| T47 | **Pathfinding / navigation mesh** | NavMesh, NavMesh Agent · Nav Mesh Bounds Volume, AI MoveTo · NavigationRegion, NavigationAgent | I | Pathfinding is how a character finds a way around walls to reach a goal, using a map of walkable ground. | Drop walls on a grid; a pet recalculates its route to its food bowl and a blue walkable-area overlay updates. | T20 |
| T48 | **Game AI (NPC behaviour)** | NavMesh + state machines / Behavior packages · Behavior Tree + Blackboard, StateTree · state machines, behaviour-tree add-ons | I | Game AI is the pretend brain that makes enemies and characters seem to think — patrol, chase, flee. | Pick a guard's behaviour cards (Patrol → sees player → Chase → loses player → Return) and sneak past it. | T30, T47 |
| T49 | **"Game AI" vs generative AI** | — | I | Game AI is a set of rules built by designers; chatbots and image makers are a different kind of AI. | The mentor (a generative AI) and a guard (rule-based AI) both "talk"; kid inspects the guard's 4 rule cards vs the mentor's "I learned from lots of text". | T48 |
| T50 | **Audio playback (sources and listener)** | AudioSource / AudioListener · Audio Component · AudioStreamPlayer(2D/3D) | I | The game plays sounds from "speakers" placed on things, heard by an "ear" usually on the camera. | Move the camera's ear away from a waterfall and hear it get quieter. | S1 |
| T51 | **UI and HUD** | UI Toolkit / uGUI (Canvas) · UMG Widget Blueprints · Control nodes, CanvasLayer | C | The HUD is the stuff drawn on top of the game — health, score, map — that isn't in the world itself. | Toggle the HUD off mid-game: suddenly you don't know your health. | T13 |
| T52 | **Save data and persistence** | PlayerPrefs, files · SaveGame / SaveGameToSlot · FileAccess, ConfigFile, Resources | C | Saving writes the game's notebook to storage so you can pick up where you left off. | Play, collect 5 gems, "turn the game off"; with saving off they're gone, with saving on they're back. | T27 |
| T53 | **Multiplayer, server and client** | Netcode for GameObjects [k] · Replication, dedicated servers · MultiplayerAPI, MultiplayerSynchronizer [k] | X | In online games each player's computer (a client) talks to a server that keeps everyone's game in sync. | Two panels show "your screen" and "friend's screen" with a delay slider; see a punch land late. | T4 |
| T54 | **Network lag / latency / ping** vs frame lag | — | I | Ping is how long a message takes to travel to the server and back; network lag is not the same as a low frame rate. | Two sliders, "FPS" and "ping": kid feels choppy (low FPS) vs rubber-banding (high ping) and names each. | T3, T53 |
| T55 | **Platforms and builds** | Build Profiles · Platforms / Package · Export presets | C | A build is a version of the game made for one kind of device — Windows, phone, console or web. | Same game, three "boxes": web, phone, console; each needs different controls and screen size. | E44 |
| T56 | **Versions, patches and hotfixes** | — | I | A patch is an update that fixes bugs or adds things after release; a hotfix is an emergency patch. | Kid ships v1.0, a player reports a bug, kid fixes it and ships v1.0.1 with patch notes. | T29, T55 |
| T57 | **Localisation-ready text** | Localization package · Localization Dashboard · Translation (CSV/PO) | X | Keeping all the words in one list means the game can be translated into other languages. | Flip the game into Spanish and see the menu button overflow — then fix the layout. | T51 |
| T58 | **Particles (the technical side)** | Particle System / VFX Graph · Niagara · GPUParticles2D/3D, CPUParticles | I | A particle system is a spray-can that shoots out hundreds of tiny pictures to make fire, smoke or sparkles. | See A27; here the lesson is "each particle costs a little" (with T40). | A27, T40 |

---

## Domain 3 — Game design

Sources for the frameworks: MDA — Hunicke, LeBlanc & Zubek 2004,
https://users.cs.northwestern.edu/~hunicke/MDA.pdf [vs, via 02 file]; Fullerton, *Game Design
Workshop* (formal elements, playcentric iteration) [vs, via 02]; Swink, *Game Feel* [vs, via 02];
"Juice It or Lose It", GDC Europe 2012, https://www.gdcvault.com/play/1016487/Juice-It-or-Lose [vs,
via 02]; Nintendo's four-step level structure (kishōtenketsu) — Koichi Hayashida, Super Mario 3D
Land, https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design and
https://www.gamedeveloper.com/design/the-structure-of-fun-learning-from-i-super-mario-3d-land-i-s-director
[vs]; blockout/greybox — The Level Design Book, https://book.leveldesignbook.com/process/blockout
[vs].

### 3.1 The heart of a game

| ID | Concept | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|
| D1 | **Mechanic / verb** | C | A mechanic is something the player *can do* — jump, shoot, dig, trade — usually a verb. | "Verb roulette": spin JUMP / PUSH / GROW / SWAP; the AI builds a tiny game around the verb. | — |
| D2 | **Rules** | C | Rules say what's allowed and what happens — "touch lava, lose a life". | Change one rule in a finished game ("coins now hurt you") and play the chaos. | D1 |
| D3 | **Goal** | C | The goal is what the player is trying to do — reach the flag, collect 10 stars, survive 60 seconds. | Same level, three goals (speed-run / collect-all / don't-get-seen): three different games. | D2 |
| D4 | **Win and lose conditions** | C | Win and lose conditions are the exact moments the game says "you did it!" or "game over". | A game with no lose condition — is it still fun? Add "3 lives" and replay. | D3 |
| D5 | **Obstacles / challenge** | C | An obstacle is anything between you and your goal that makes it interesting. | Remove every enemy from a level; play; boring. Add one back. | D3 |
| D6 | **Core loop** | C | The core loop is the thing you do again and again — like "explore → fight → loot → upgrade". | Drag 3–4 action cards into a circle; the AI builds a 2-minute game of that loop. | D1, D3 |
| D7 | **Meta loop / progression** | I | Progression is the bigger journey across many rounds — unlocking levels, skills and costumes. | Add an "unlock a new hat every 5 coins" layer to the core-loop game and see if it pulls you back. | D6 |
| D8 | **MDA: mechanics → dynamics → aesthetics** | I | Rules (mechanics) make things happen when people play (dynamics), which makes feelings (aesthetics). | Change gravity (mechanic) → jumping gets floaty (dynamic) → it feels dreamy (aesthetic). Kid labels the three. | D2, D6 |
| D9 | **Feedback** | C | Feedback is the game answering you — a sound, flash or number — so you know what just happened. | Coin with no feedback vs with ping + sparkle + "+1"; kid can't even tell they collected the silent one. | D1 |
| D10 | **Game feel / "juice"** | C | Juice is all the extra wiggle, shake, squash and sparkle that makes actions feel great. | "Juice board": toggle screen shake, squash, particles, sound, hit-pause one at a time on a dull breakout game. | D9 |
| D11 | **Balance** | I | Balance means no single choice is always best, so every option is worth trying. | A three-character select where one is overpowered; kid tweaks numbers until playtesters pick all three. | D2, T27 |
| D12 | **Difficulty curve** | C | The difficulty curve is how the game gets harder over time — best as a gentle slope with little breathers. | Kid orders 6 level cards on a graph; a playtest bot "gets frustrated" on spikes. | D5 |
| D13 | **Flow** | I | Flow is the "in the zone" feeling when the challenge matches your skill exactly. | Game with an auto-difficulty dial the kid can switch on; compare "bored", "flow", "panic". | D12 |
| D14 | **Risk vs reward** | I | Bigger rewards should cost bigger risks — the gem on the edge of the cliff. | Two paths: safe with 1 coin, dangerous with 10; watch what playtesters choose. | D5 |
| D15 | **Meaningful choice** | I | A choice matters when each option changes what happens and neither is obviously best. | "Sword or shield?" where both change the next room vs a fake choice that doesn't. | D11 |
| D16 | **Emergence** | X | Emergence is when simple rules combine into surprises nobody planned. | Give fire "spreads to grass" and wind "pushes fire"; kids discover wildfire tactics. | D8 |
| D17 | **Fairness and readability** | I | A fair game lets you see danger coming, and when you lose you know why. | Two versions of a trap: one with a warning wiggle, one without; kid says which death felt unfair. | D9, T35 |
| D18 | **Replayability** | X | Replayability is what makes you want to play again — randomness, choices, high scores, secrets. | Add a high-score table and a random seed to a 30-second game; compare "one more go?" urges. | D7, T44 |
| D19 | **Game modes (single-player, co-op, versus)** | I | A mode is a way to play: alone, together on the same team, or against each other. | Same arena, switch co-op ↔ versus; a friend (or bot) joins. | D3 |
| D20 | **Design pillars / vision** | I | Pillars are 3 words the whole team agrees the game must feel like, used to say yes or no to ideas. | Pick 3 pillars ("cosy, clever, cute"); the AI pitches 6 features; veto the ones that break a pillar. | D8 |
| D21 | **Game design document (GDD) / one-pager** | I | A design document is the written plan so everyone on the team builds the same game. | Fill in a one-page template (verb, goal, loop, look, pillars); the AI builds from it — and builds wrong where it's vague. | D20 |
| D22 | **Paper prototype** | I | A paper prototype tests the rules with paper and dice before anyone builds anything. | Drag-and-drop paper pieces on a virtual table and play the rules turn by turn. | D2 |
| D23 | **Playtesting** | C | Playtesting is watching real people play your game — silently — to learn what they actually do. | Kid watches a recording of a bot/peer playing their level; marks every spot they got stuck. | D3 |

### 3.2 Level design

| ID | Concept | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|
| D24 | **Level design** | C | Level design is planning a place to play — where every wall, jump, enemy and treasure goes and why. | Rearrange the same 10 pieces into an easy level, then a hard one. | D5, E26 |
| D25 | **Teach → test → twist → finish** (kishōtenketsu) | C | Great levels introduce an idea safely, test it, twist it in a surprising way, then finish with a flourish. | Four blank rooms, one new mechanic (moving platform); kid fills each room for a stage; a playtest bot "learns" it. | D24 |
| D26 | **Blockout / greybox** | I | A blockout is a level built from plain grey boxes to test if it's fun before artists make it pretty. | Build a grey level, play it, then press "art pass" and watch it get dressed in art — same layout. | D24 |
| D27 | **Critical path vs optional areas** | I | The critical path is the one route you must take; side paths hold secrets for curious players. | Colour the main route gold; hide a secret room off it; see if a playtester finds it. | D24 |
| D28 | **Landmarks and sightlines** | I | A landmark is a big, memorable thing players can see from far away so they don't get lost. | Navigate a maze-town without, then with, a giant glowing tower. | D24 |
| D29 | **Signposting / guiding the player** ("yellow paint", lighting, breadcrumbs) | I | Designers secretly guide you with light, colour, paths and coins so you know where to go. | Put a coin trail and a lit doorway into a dark room; watch the bot follow. | D28 |
| D30 | **Gating (locks and keys)** | I | A gate blocks you until you get what you need — a key, a new power, a boss beaten. | Place a blue door and a blue key; try putting the key *behind* the door. Oops. | D27 |
| D31 | **Pacing (tension and release)** | I | Pacing is mixing hard, scary bits with calm, safe bits so players don't get worn out. | A tension graph under the level updates as kid places enemies and safe rooms. | D12 |
| D32 | **Environmental storytelling** | X | The world itself tells a story — a broken bridge, footprints, an abandoned camp. | Place 3 props so a playtester guesses "a dragon lived here". | D24, D40 |
| D33 | **Checkpoints** | I | A checkpoint saves your spot mid-level so a mistake doesn't send you all the way back. | Play a long level without, then with, a checkpoint flag. | D24, T52 |

### 3.3 Players: motivation, onboarding, UX, accessibility

| ID | Concept | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|
| D34 | **Onboarding / tutorial** | C | Onboarding is teaching new players how to play — best done by *playing*, not reading. | Same mechanic taught by a wall of text vs by a safe first room; kid watches which a bot learns faster. | D25 |
| D35 | **Affordance** | I | An affordance is a look that says what something does — a big red button begs to be pressed. | Which of 4 doors looks openable? Which looks locked? Kid redesigns one to be clearer. | D9 |
| D36 | **Player motivation** (competence, freedom, friendship; player types) | I | People play for different reasons — to get better, to explore, to be with friends, to win. | Quick "what kind of player are you?" quiz, then design one reward for each type. | D3 |
| D37 | **Rewards** (and fair reward design) | I | Rewards are the good stuff you get — points, items, new abilities, a funny scene. | Try a level with "points" vs "a new power" as the reward; which pulls you forward? | D36 |
| D38 | **UX (user experience)** | C | UX is making the game easy and pleasant to understand, from the menu to the last level. | "Confusing menu" challenge: fix a title screen where the Play button is tiny and grey. | D9, T51 |
| D39 | **Accessibility** | C | Accessibility means more people can play: remappable keys, subtitles, colour-blind modes, slow-down options. | Play a level through a colour-blindness filter; red/green switches are identical; add shapes to fix it. | D38 |
| D40 | **Narrative / story** | I | Narrative is the story the game tells — who you are, what you want, and what stands in the way. | Six-word story for your game; the AI makes a title card from it. | — |
| D41 | **Characters and NPCs** | C | An NPC (non-player character) is anyone in the game the player doesn't control. | Talk to a shopkeeper NPC; then write their three lines. | D40 |
| D42 | **Worldbuilding / lore** | X | Worldbuilding is inventing the places, history and rules of your game's world. | Fill a "world card": name, weather, what people eat, what they're scared of. | D40 |
| D43 | **Dialogue and branching choices** | I | Branching dialogue lets players choose what to say, and the story changes with their choice. | A mini dialogue tree: kid adds one choice that leads to a different ending. | D40, D15 |
| D44 | **Genres** | C | A genre is a family of games that play alike — platformer, puzzle, racing, RPG, shooter, sim, strategy. | Sort 12 famous (age-appropriate) games into genre boxes; argue about the tricky ones. | D1 |
| D45 | **Game economy (sources and sinks)** | X | A game economy is how coins come in (sources) and go out (sinks) so they stay worth something. | Shop game where coins pour in but there's nothing to buy; add sinks until coins matter again. | D11, T27 |
| D46 | **Boss design / "final exam"** | X | A boss fight tests everything you learned, with patterns you can learn and beat. | Give a boss 3 attack patterns with warnings; playtest; add a "tell" to the unfair one. | D25, D17 |
| D47 | **Ethical design** (no tricks: honest rewards, no pressure to pay) | I | Good designers don't trick players into playing or paying more than they want to. | Spot the sneaky trick in 4 fake shop screens (countdown pressure, hidden price). | D37, B8 |

---

## Domain 4 — Art and animation

Animation principles: Thomas & Johnston, *The Illusion of Life* (1981), the twelve principles —
https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation [vs].

| ID | Concept | Unity · Unreal · Godot (tool/feature) | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|---|
| A1 | **Concept art** | — (made in Photoshop, Krita, Procreate) | C | Concept art is fast drawings that explore what the game *could* look like before anything gets built. | Mentor shows 6 rough sketches of the same castle; kid picks one and the AI builds that direction. | — |
| A2 | **Mood board / reference** | — | I | A mood board is a wall of pictures that capture the feeling you want. | Drag 6 images onto a board; the game's colours shift to match the board. | A1 |
| A3 | **Art style** | — | C | Art style is the game's "look" — pixel, cartoon, painterly, realistic, low-poly. | Same level flipped through 4 styles; kid picks and names them. | A1 |
| A4 | **Style guide** | — | I | A style guide is the rulebook that keeps everyone's art looking like the same game. | Two artists' goombas look different; kid writes 3 rules (outline thickness, palette, eye shape) to match them. | A3 |
| A5 | **Silhouette and readability** | — | C | A good character is recognisable even as a black shape — that's the silhouette test. | Black out hero and 3 enemies; can you tell them apart? Redesign one. | A3 |
| A6 | **Colour palette & colour meaning** | — | C | A palette is the small set of colours a game uses; colours can mean things (red = danger). | Recolour a level so every danger is red and everything safe is blue; playtest with a friend. | A3 |
| A7 | **Shape language** | — | X | Shapes send feelings: circles feel friendly, squares feel strong, spikes feel dangerous. | Build a friend, a tank and a villain from only circles, squares or triangles. | A5 |
| A8 | **Pixel art** | Sprite import (Point filter) · Paper2D · Texture filter Nearest | C | Pixel art is art drawn one square at a time, like the classic 8-bit and 16-bit games. | A 16×16 pixel editor; draw a coin; it appears in-game instantly. | T10 |
| A9 | **2D art (hand-drawn, vector)** | Sprite · Paper2D Sprite · Sprite2D | I | 2D art is flat drawings — painted, cartoon or pixel — used for characters and backgrounds. | Swap pixel coin for a painted one; talk about why pixel art is sometimes easier. | A8 |
| A10 | **Placeholder / programmer art** | — | I | Placeholder art is quick boxes and scribbles used until the real art is ready. | Play a game made of coloured squares — it's still fun! Then swap in art. | D26 |
| A11 | **Assets, sprites and file types** (PNG, WAV, glTF/FBX) | — | X | Each kind of asset has a file type, like a picture being a PNG and a 3D model being a glTF or FBX. | Match 5 file icons to what they hold. | E11 |
| A12 | **Tiles and tilesets** | Tile / Tile Palette · Paper2D Tile Set · TileSet | I | Tiles are small matching squares you repeat to build big worlds, like floor tiles. | Paint a whole island from a 9-tile set; see how corner tiles make edges look right. | A8 |
| A13 | **Parallax background** | (layered sprites/cameras) · — · ParallaxBackground / Parallax2D [k] | X | Parallax makes far-away layers move slower, so a flat game feels deep. | Toggle parallax on a side-scroller: mountains suddenly look far away. | T23 |
| A14 | **3D modelling (low-poly vs high-poly)** | — (Blender, Maya, 3ds Max) | I | 3D modelling is building objects out of points, edges and faces in a 3D program. | A 3D "clay" sandbox: pull a cube's corners to make a house. | T16 |
| A15 | **Sculpting** | — (ZBrush, Blender) | X | Sculpting is shaping a 3D model like digital clay, for detailed creatures and faces. | Push/pull brush on a blob to make a nose. | A14 |
| A16 | **UV unwrapping** | — | X | UV unwrapping is peeling a 3D model flat like an orange skin so you can paint on it. | Watch a cube "unfold" into a cross; paint a face on the flat version; it wraps back. | A14, T15 |
| A17 | **Texturing (and PBR maps)** | — (Substance Painter, Blender) | X | Texturing is painting the surface detail — rust, wood grain, scratches — onto a 3D model. | Paint scratches onto a sword and see them appear on the 3D model. | A16 |
| A18 | **Rigging (skeleton, bones)** | Avatar / Skeleton · Skeleton, Skeletal Mesh · Skeleton2D/3D, Bone2D | I | Rigging puts an invisible skeleton inside a character so animators can pose it like a puppet. | Drag a character's arm bone; the arm bends; turn the skeleton view on and off. | A14 or A9 |
| A19 | **Keyframes and in-betweens (tweening)** | Animation window keyframes · Sequencer keys · AnimationPlayer tracks/keys | C | A keyframe is an important pose; the computer (or animator) fills in the in-between frames. | Set a ball at the top and bottom as two keyframes; press play; the in-betweens appear. | T1 |
| A20 | **Frame-by-frame vs skeletal animation** | Sprite animation vs Animator + rig · Flipbooks vs skeletal · AnimatedSprite vs Skeleton2D | I | Frame-by-frame means drawing every picture; skeletal means moving one character's bones. | Compare a 6-drawing run cycle to the same run done by bending a puppet's bones. | A19, A18 |
| A21 | **Sprite sheet / flipbook** | Sprite Editor (sliced sheet) · Paper2D Flipbook · SpriteFrames | C | A sprite sheet is all of a character's animation frames drawn on one page, played in order like a flipbook. | Slice a sheet into 4 frames and set the speed; the hero walks. | A19, T14 |
| A22 | **Animation cycles (idle, walk, run)** | Animation Clip (loop) · Animation Sequence · Animation (loop) | C | A cycle is an animation that loops forever without a bump — like idle breathing or a walk. | Fix a walk cycle that "hiccups" because the last frame doesn't match the first. | A21 |
| A23 | **Animation states and transitions** | Animator Controller · Animation Blueprint state machine · AnimationTree state machine | I | The game switches between animations — idle, run, jump — when things happen. | Draw arrows between animation bubbles; hero plays the right one. | A22, T30 |
| A24 | **Animation principles: squash & stretch, anticipation, follow-through, timing, exaggeration, arcs, slow-in/out** | — | C (squash & stretch, anticipation, timing) · I (the rest) | These are the 12 classic tricks animators use to make things look alive instead of stiff. | Bouncing-ball lab: toggle squash & stretch, anticipation and ease; feel the difference. | A19 |
| A25 | **Motion capture** | — | X | Mocap records a real actor's movement with sensors and puts it onto a game character. | Video clip of a mocap suit next to the in-game character copying it. | A18 |
| A26 | **Inverse kinematics (IK)** | Animation Rigging IK · IK Rig, Control Rig · SkeletonIK / IK modifiers [k] | X | IK makes feet stand properly on stairs by working backwards from where the foot should go. | Walk a character up stairs with IK off (feet float) and on (feet plant). | A18 |
| A27 | **VFX and particles** | Particle System, VFX Graph · Niagara · GPUParticles / CPUParticles | C | VFX (visual effects) are fire, smoke, magic and sparkles, usually made from particles — lots of tiny pictures shot out of an emitter. | Explosion builder: sliders for count, speed, lifetime, colour, gravity; make a campfire, then fireworks. | T14 |
| A28 | **Emitter, lifetime, spawn rate** (particle vocabulary) | Emission, Start Lifetime · Spawn Rate, Lifetime · Amount, Lifetime | X | An emitter is where particles come from; lifetime is how long each one lives. | Shrink lifetime and the smoke gets short; raise spawn rate and it thickens. | A27 |
| A29 | **Lighting art / mood lighting** | Lighting window, light probes · Lumen, Post Process · WorldEnvironment, LightmapGI [k] | I | Lighting artists use light and shadow to set mood and point your eye where to go. | Make a spooky room cosy with only lights. | T19 |
| A30 | **Environment art** | — (modular kits, props, foliage) | I | Environment art is everything in the world that isn't a character — buildings, rocks, trees, skies. | "Art pass" on a greybox: swap boxes for castle pieces, add props. | D26 |
| A31 | **Modular kits and props** | Prefabs of kit pieces · Static Mesh kits · scenes of kit pieces | X | A modular kit is a set of matching wall, floor and door pieces that snap together like Lego. | Build three different rooms from the same 8 kit pieces. | A30, E18 |
| A32 | **Character art** | — | I | Character artists design and build the heroes, villains and creatures. | Design a hero from mix-and-match parts; run the silhouette test. | A5 |
| A33 | **UI art (icons, buttons, fonts)** | Sprites/UI Toolkit styles · UMG styles · Theme (Control nodes) | I | UI art is the look of buttons, icons, health bars and fonts. | Redesign 3 icons so they read at tiny sizes. | T51 |
| A34 | **Technical art** | Shader Graph, VFX Graph, tools · Material Editor, Niagara, Houdini · Visual Shader, tool scripts | I | Technical art is the bridge between art and code: shaders, effects, tools and keeping art fast. | Make the same explosion look as good with half the particles. | A27, T40 |
| A35 | **Art pipeline** (concept → model → texture → rig → animate → in engine) | — | I | The art pipeline is the assembly line an asset travels down from sketch to game. | Drag 6 stage cards into order; a dragon appears step by step. | A1, A14, A18 |
| A36 | **Key art / marketing art** | — | X | Key art is the big poster image used on store pages and boxes. | Make a store thumbnail for your game from 3 layers. | A3, B11 |

---

## Domain 5 — Sound

| ID | Concept | Unity · Unreal · Godot | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|---|
| S1 | **Sound effects (SFX)** | AudioClip · Sound Wave / Sound Cue · AudioStream | C | Sound effects are short sounds for actions — jump, coin, ouch, door creak. | Play the level muted, then with SFX; kid rates how much more "alive" it feels. | — |
| S2 | **Foley** | — | I | Foley is making sound effects with real objects — celery snapping for bones, gloves flapping for wings. | Guess-the-object quiz: 5 foley sounds and their surprising sources. | S1 |
| S3 | **Ambience / background sound** | — | I | Ambience is the background sound of a place — wind, birds, rain, city hum. | Toggle forest vs cave ambience on the same room. | S1 |
| S4 | **Music** | — | C | Music sets the mood and energy of a game. | Same chase scene with happy, scary and silly music. | — |
| S5 | **Loops and stingers** | Loop setting · Looping · Loop | I | A loop is music that repeats seamlessly; a stinger is a short blast that plays on a big moment. | Fix a music loop with a gap; add a victory stinger to the flag. | S4 |
| S6 | **Adaptive / dynamic music** (layering, resequencing) | Audio Mixer / middleware · MetaSounds, Quartz, or Wwise/FMOD · AudioStreamInteractive / Synchronized [k] | I | Adaptive music changes with what's happening — drums join in when enemies appear. | Layer sliders (calm pad, drums, danger strings) auto-rise as an enemy gets closer. | S4 |
| S7 | **Voice acting / VO** | — | I | Voice acting is actors recording the characters' lines. | Record (or pick) a line in 3 moods; hear how it changes the character. | D41 |
| S8 | **Barks** | — | X | Barks are short lines characters shout during play — "Reloading!", "Over here!". | Give a guard 3 barks for "saw you", "lost you", "found you". | S7, T48 |
| S9 | **Mixing and volume balance** | Audio Mixer groups · Submixes, Sound Classes · Audio buses | I | Mixing is balancing loudness so music doesn't drown out important sounds. | Three sliders (music, SFX, voice); fix a mix where the music hides the warning beep. | S1, S4 |
| S10 | **Spatial / 3D audio and attenuation** | Spatial Blend, 3D sound settings · Attenuation, spatialisation · AudioStreamPlayer3D, attenuation | I | Spatial audio makes sounds come from a direction and get quieter with distance. | Close your eyes (headphones) and find a beeping treasure by sound alone. | T50 |
| S11 | **Audio as feedback / juice** | — | C | Sound tells players what happened even when they're not looking. | Play with eyes closed: can you tell coin, hurt and win apart? | D9, S1 |
| S12 | **Audio middleware (FMOD, Wwise)** | FMOD/Wwise integrations · MetaSounds built-in; Wwise/FMOD plugins · FMOD/Wwise add-ons | X | Middleware is a separate audio tool sound designers use to build interactive sound without code. | Card: "real studios use FMOD or Wwise for S6". | S6 |
| S13 | **Silence** | — | X | Leaving sound out can be the scariest or most powerful choice of all. | Remove all music before a boss door; feel the tension. | S4 |
| S14 | **Licensing and credits (CC0, attribution)** | — | I | You may only use art and sound you're allowed to; some are free for anyone (CC0), some need credit. | Sort 5 assets into "use freely", "credit the maker", "not allowed". | E15 |

---

## Domain 6 — Production and process

Milestone definitions vary by studio; the common versions: first playable proves the core mechanic;
**vertical slice** is a small section at near-final quality, used to pitch; **alpha** = feature
complete, playable start to finish, not content complete; **beta** = content complete, focus on
bugs and optimisation; **gold** = the version that ships [vs] (GameDevProducer.com, "Alpha, Beta,
Gold", https://gamedevproducer.com/posts/what-is-a-game-milestone-alpha-beta-gold/). Bug-report
anatomy — title, repro steps, expected, actual, environment, severity; severity (impact) is separate
from priority (urgency) [vs] (Bugnet, "How to Write Good Bug Reports for Game Development",
https://bugnet.io/blog/how-to-write-good-bug-reports-for-game-development; Game Developer, "How To
Report Bugs", https://www.gamedeveloper.com/design/how-to-report-bugs). Crunch: in the IGDA 2023
Developer Satisfaction Survey, 28% said their job involved crunch and a further 25% reported long
hours they did not call crunch, down from 41% (crunch) in 2019 [vs]
(https://www.gamedeveloper.com/audio/crunch-and-extended-hours-both-down-in-latest-igda-dev-satisfaction-survey).

| ID | Concept | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|
| P1 | **Pitch** | I | A pitch is a short, exciting explanation of your game idea to convince people to make it. | 30-second pitch builder (hook, verb, "it's like X meets Y"); studio boss character gives a thumbs up or a question. | D20 |
| P2 | **Prototype** | C | A prototype is a quick, ugly test version made only to answer "is this fun?" | Build a 5-minute greybox of one mechanic; decide "keep, change or throw away". | D22, D26 |
| P3 | **Iteration** | C | Iteration means make → test → change → test again, many times. It's how every good game gets good. | Same jump tuned across 4 rounds with playtest feedback; a "version history" strip shows v1→v4. | P2, D23 |
| P4 | **Phases: concept → pre-production → production → post-launch** | I | Games are made in stages: dream it, plan and test it, build it all, then look after it once it's out. | A studio calendar the kid moves the project along; each phase unlocks different quests. | P2 |
| P5 | **First playable** | X | The first playable is the first time the main idea works from start to finish, even if it's ugly. | Unlock badge when the kid's game first has a win and lose condition. | P2, D4 |
| P6 | **Vertical slice** | I | A vertical slice is one small piece of the game made to look and feel finished, to show what the whole game will be like. | Pick one level and polish it fully (art, sound, juice) while the rest stays grey. | P5 |
| P7 | **Milestones: alpha, beta, gold, launch** | C | Milestones are checkpoints for the team: alpha = all features in, beta = all content in and bug hunting, gold = ready to ship. | Studio wall-chart: the kid's own project gets stamped Alpha, Beta, Gold as they finish each. | P4 |
| P8 | **Scope and scope creep** | C | Scope is how big your game is; scope creep is when "just one more feature" makes it too big to finish. | 12 feature cards but only 10 "hours"; the "what if we also…" character keeps adding cards. | P3 |
| P9 | **Cutting features (MVP, "kill your darlings")** | C | Cutting means removing good ideas so the game can actually be finished and be great. | Cut 4 of 12 cards; the game ships on time and the producer celebrates. | P8 |
| P10 | **Tasks, estimates and dependencies** | I | A task is one job; an estimate is a guess of how long; a dependency is "this can't start until that is done". | Order cards where "animate the dragon" needs "draw the dragon" first. | P9 |
| P11 | **Task board (Kanban: To do / Doing / Done)** | I | A task board shows every job and where it is, so the team knows what's happening. | The kid's quests live on a board; they drag them across as they work. | P10 |
| P12 | **Sprints / agile** | X | A sprint is a short burst (often 2 weeks) where a team picks jobs, does them and shows the result. | "One-week sprint" with 3 quests and a demo to the boss at the end. | P11 |
| P13 | **Deadlines and schedules** | I | A deadline is when something must be finished; a schedule is the plan that gets you there. | A delay card ("the artist is sick") forces a replan. | P10 |
| P14 | **QA (quality assurance)** | C | QA is the team that tests the game to find problems before players do. | Bug bounty: play a deliberately buggy level, find 5 bugs. | T29 |
| P15 | **Bug report (title, steps to reproduce, expected, actual)** | C | A good bug report tells someone exactly how to make the bug happen again, what should happen and what happens instead. | Kid writes a report; an "AI programmer" follows the steps literally; vague steps = "can't reproduce". | P14 |
| P16 | **Severity vs priority** | I | Severity is how bad a bug is; priority is how soon it must be fixed — they're not the same. | Sort bugs: crash on level 1 (critical/urgent), typo in credits (minor/low), typo on the Buy button (minor but urgent!). | P15 |
| P17 | **Bug tracker / bug database** | I | A bug tracker is the shared list of every known bug and who is fixing it. | The kid's reports appear on the studio's bug board; the programmer character marks one "Fixed". | P15 |
| P18 | **Regression** | X | A regression is when fixing one thing accidentally breaks something that used to work. | Fix a door bug; the jump stops working; re-test everything. | P17 |
| P19 | **Version control (commit, history, branch, merge, conflict)** | I | Version control is a save-point system for the whole team, so anyone can go back in time and nobody overwrites anyone. | Two characters edit the same level at once — "conflict!" — kid picks which change to keep; then rolls back to yesterday. | E42 |
| P20 | **Backups** | I | A backup is a spare copy so nothing is lost if a computer breaks. | "Laptop spills juice" event; only the backed-up project survives. | E42 |
| P21 | **Feedback and critique** ("I like / I wish / what if") | C | Good feedback is kind, specific and helpful — about the game, not the person. | Rewrite 3 mean comments into helpful ones; then give feedback on a peer's (or bot's) level. | D23 |
| P22 | **Teamwork and hand-offs** | C | Games are made by teams; everyone depends on each other's work. | The "door problem" quest (see R section): one door needs design, art, animation, sound, code and QA. | P10 |
| P23 | **Game jam** | I | A game jam is a challenge to make a whole game in a short time around a theme. | A 20-minute mini-jam with a random theme and a showcase. | P2, P9 |
| P24 | **Postmortem** | I | A postmortem is looking back after a project: what went right, what went wrong, what we'll do next time. | After shipping, fill a 3-column board and pick one lesson for the next project. | P7 |
| P25 | **Crunch and healthy work** | I | Crunch is when a team works very long hours to hit a deadline; good studios plan so it doesn't happen. | Two simulated teams: one crunches (more bugs, tired faces), one cuts scope; compare results. | P8 |
| P26 | **Polish** | I | Polish is the last pass of tiny improvements that make a game feel finished. | Checklist of 10 polish items (juice, sounds, menus) applied to the kid's game. | D10 |
| P27 | **Release / shipping** | C | Shipping is releasing the game so real players can play it. | "Ship it" makes a playable link for classmates. | E44 |
| P28 | **Post-launch: updates, live ops, DLC** | I | After release, teams keep fixing and adding things — updates, events and extra content. | A weekend "event" for the kid's game (double coins), announced with patch notes. | P27, T56 |
| P29 | **Patch notes** | I | Patch notes tell players what changed in an update. | Write patch notes for your own last three changes. | T56 |
| P30 | **Certification / platform requirements** | X | Console makers test your game against their rules before letting it on their store. | "Cert checklist" fail: game doesn't pause when controller unplugs. | P27, B1 |
| P31 | **Localisation** | X | Localisation is adapting a game for other languages and countries. | Translate the title screen; fix text that doesn't fit. | T57 |
| P32 | **Credits** | I | Credits list everyone who made the game — and the assets you borrowed. | Build your own credits screen, including CC0 asset makers. | S14 |
| P33 | **Playtest types** (friends, strangers, focus tests, analytics) | X | Different playtests answer different questions — friends are nice, strangers are honest, numbers show patterns. | Heatmap overlay of where 50 bot players died on your level. | D23 |

---

## Domain 7 — Roles and careers

Primary sources: ScreenSkills games job profiles, https://www.screenskills.com/job-profiles/browse/games/
(profiles seen in search this session: games tester, QA build engineer, technical artist, VFX artist,
games producer, lead games designer, animator, technical animator, concept artist, sound designer,
music composer) [vs]; ScreenSkills games career map, https://www.screenskills.com/media/xskl5wdb/2756-games-career-map-interactive-feb25-final.pdf
[vs]; Liz England, "The Door Problem" (2014), https://lizengland.com/blog/the-door-problem/ — also
archived by the IGDA, https://igda.org/resources-archive/the-door-problem-2014/ [vs]; Game Developer,
"Types of Designers", https://www.gamedeveloper.com/design/types-of-designers [vs]; DigiPen,
"Technical Design", https://www.digipen.edu/showcase/news/digipen-game-design-disciplines-explained-technical-design
[vs]. Key snippet facts: QA tester is an entry-level role from which people move into design,
animation or programming, or make QA a career [vs]; VFX artists usually spend years as game artists
first [vs]; technical animators usually start in animation or programming [vs]; technical artists
work alongside modellers, environment, texture and VFX artists and graphics programmers [vs]; the
games industry historically called manual testers "QA testers" and now also employs QA/automation
engineers [vs].

**Teaching device: The Door Problem.** England's essay shows how one door involves every role (the
designer asks whether it locks, the artist what it looks like, the animator how it opens, the sound
designer what it sounds like, the programmer how it works, QA whether you can get stuck in it, the
producer whether there's time for it). This is the single best activity for making roles concrete:
one door, seven studio characters, seven questions.

### 7.1 Programming family

| ID | Role | What they do (kid) | Not to be confused with | Tier | Aha |
|---|---|---|---|---|---|
| R1 | **Gameplay programmer** | Turns the designer's rules into working game — how the player moves, how enemies fight, how coins count. | Game designer (decides the rules; the gameplay programmer makes them work) | C | "Be the computer": plain-English rule cards the AI follows literally; find the gaps. |
| R2 | **Engine programmer** | Builds and improves the engine itself — the toolbox every other programmer uses (memory, loading, core systems). | Gameplay programmer (uses the engine to make *this* game) | I | "Toolbox vs toy": engine programmer upgrades the physics toolbox; every game in the studio gets better at once. |
| R3 | **Tools programmer** | Makes the buttons, editors and helpers that let artists and designers work faster. | Engine programmer (the tools programmer serves the team's workflow, not the running game) | I | A level designer character complains "placing 500 trees by hand takes forever"; kid "orders" a tree-painting brush. |
| R4 | **Graphics / rendering programmer** | Makes the engine draw beautifully and fast — lighting, shadows, water, shaders. | Technical artist (uses the graphics tech artistically; the graphics programmer builds it) | I | Toggle shadows, reflections, glow; "this is what the graphics programmer built". |
| R5 | **Network / online programmer** | Makes multiplayer work — keeping every player's game in sync over the internet. | Server/IT admin | X | Ping slider demo (T54). |
| R6 | **AI programmer** | Builds the systems that make enemies and characters seem smart — pathfinding, decision-making. | Generative-AI researcher; game designer (who decides *what* the enemy should do) | I | Guard behaviour cards (T48). |
| R7 | **Physics programmer** | Makes things fall, bounce, crash and ragdoll believably. | Gameplay programmer | X | Physics sliders (T33). |
| R8 | **UI programmer** | Makes menus, HUDs and buttons actually work. | UI artist (draws them), UX designer (plans them) | X | Wire a menu button to open the settings screen. |
| R9 | **Audio programmer** | Connects sounds to the game — 3D audio, music systems, audio tools. | Sound designer (makes the sounds) | X | S10 treasure-by-sound. |
| R10 | **Build / release engineer (and QA build engineer)** | Makes sure the game can be built for every platform every day, automatically. | Tools programmer | X | Nightly build light: green ✓ or red ✗ on the studio wall. ScreenSkills has a "QA build engineer" profile [vs]. |
| R11 | **"Environment" / world programmer — see 7.2** | Codes the systems that make the world itself: terrain, foliage, water, weather, sky, world streaming. | Environment artist; level designer | X | See 7.2. |

### 7.2 What "environment programmer" actually means

**Finding: "environment programmer" is not a standard, widely used job title.** Searches this session
turned up environment *artist* jobs, a "Senior Technical Artist (Environment)" posting that covers
foliage pipelines, weather effects and procedural biome generation [vs]
(https://builtin.com/job/senior-technical-artist-environment/3374615), an environment-artist posting
asking for procedural tools (PCG, Houdini, procedural foliage) [vs]
(https://alderongames.com/work-with-us/environmental-artist), and a GDC 2018 Guerrilla talk on a
procedural vegetation system for Horizon Zero Dawn's Decima engine [vs]. A search summary explicitly
reported no standard "environment programmer" or "world programmer" title [vs, search summary]. The
titles in common use are **engine, graphics/rendering, tools, gameplay, AI, network, physics, audio,
UI** programmer (ScreenSkills and the CG Spectrum/GameDesignSkills career pages list most of these)
[vs].

**When the phrase is used** [k], it usually means one of three things, depending on the studio:

1. **A programmer on the world/environment team** — builds the *systems* behind the world: terrain,
   vegetation and foliage placement, water, weather, day/night and sky, destruction, and world
   streaming (loading the map in pieces). This is a specialism sitting between graphics and tools
   programming, most common at open-world studios. Sometimes titled "world programmer",
   "open-world programmer" or "rendering programmer (environment)".
2. **A technical artist (environment)** — the same systems work done from the art side, with
   shaders, procedural tools (Houdini, Unreal's PCG) and pipelines. Often what a job ad actually
   means.
3. **Loosely, by outsiders: "the person who makes the levels"** — which is really the **level
   designer** (layout and gameplay) and the **environment artist** (the look).

**The distinction a kid should make — the four people who make "the world":**

| Who | Makes | Asks | Tools |
|---|---|---|---|
| **Level designer** | The *layout* for play: where paths, jumps, enemies and secrets go (greybox) | "Is this fun? Can players find the way?" | Engine editor, blockout shapes |
| **Environment artist** | The *look*: buildings, rocks, trees, textures, props | "Does this look like the place, in our style?" | Blender/Maya, Substance, the engine |
| **Level artist** (at big studios) | *Dresses* the greybox using the environment artist's pieces | "Does this layout now look finished without breaking the gameplay?" | Engine editor, modular kits |
| **Environment/world programmer or tech artist** | The *systems* the world runs on: grass that sways, rivers that flow, weather, streaming | "How do we fill 100 km² with trees and still run at 60 FPS?" | C++/shaders, procedural tools |

Level artist vs environment artist is [vs] (The Level Design Book: level artist "dresses a blockout
in production ready content"; environment artists "produce the content"). Recommended course wording:
*"The level designer decides where things go; the environment artist decides what they look like; an
environment programmer or tech artist builds the machinery that makes the world alive — swaying
grass, flowing water, weather."*

### 7.3 Design family

| ID | Role | What they do (kid) | Not to be confused with | Tier | Aha |
|---|---|---|---|---|---|
| R12 | **Game designer** (generalist) | Decides the rules, goals and what makes it fun, and keeps changing them after playtests. | Programmer ("designers design, programmers build"); "game developer" (anyone who makes games) | C | One-sentence game (02 file). |
| R13 | **Systems designer** | Designs the big interlocking rule-sets and their numbers — combat, crafting, levelling, economy — usually in spreadsheets. | Level designer (works on places, not rules) | I | Tune a 3-character damage table until the fight is fair (D11). |
| R14 | **Combat / economy designer** (systems specialisms) | Specialises in one system — fights, or how coins and prices work. | Systems designer (the umbrella) | X | D45 economy sinks. |
| R15 | **Level designer** | Designs the places you play: layout, pacing, difficulty and where everything goes. | Environment artist (the look), level artist (the dressing) | C | Teach-test-twist rooms (D25). |
| R16 | **Narrative designer** | Designs how the story is told *through play* — choices, quests, what the world reveals. | Writer (writes the actual words) — often the same person at small studios | I | Place 3 story props (D32). |
| R17 | **Writer** | Writes dialogue, item descriptions, quest text — every word in the game. | Narrative designer | I | Rewrite a shopkeeper's 3 lines in a character voice. |
| R18 | **Quest designer** | Designs missions: the goal, the steps, the reward and the story reason. | Level designer | X | Build a fetch-quest with a twist. |
| R19 | **UX designer** | Plans how players understand and use the game — menus, onboarding, clarity, accessibility. | UI artist (draws the screens), UI programmer (makes them work) | I | Five-second HUD test (02 file). |
| R20 | **UI designer** | Designs the layout of menus and HUD — what goes where on screen. | UX designer (the whole experience); at small studios one person | X | Rearrange a HUD for a phone screen. |
| R21 | **Technical designer** | A designer who can also script: builds and hooks up mechanics, often in visual scripting, and knows the engine's limits. The title varies a lot by studio [vs, DigiPen / GameDesignSkills]. | Gameplay programmer | X | Wire WHEN/THEN cards (T28) — "that's tech design". |
| R22 | **User researcher** | Runs scientific playtests and turns what players do into advice for designers. | QA tester (finds bugs, not confusion) | X | Heatmap (P33). |
| R23 | **Lead / creative / game director** | Holds the vision for the whole game and says yes or no to ideas. ScreenSkills has a "lead games designer" profile [vs]. | Producer (who makes sure it gets *done*) | I | Three pillars veto (D20). |

### 7.4 Art and animation family

| ID | Role | What they do (kid) | Not to be confused with | Tier | Aha |
|---|---|---|---|---|---|
| R24 | **Art director** | Leads the art team and keeps the game's look consistent; owns the style guide. | Creative director (the whole game) | I | Approve or reject 3 assets against the style guide (A4). |
| R25 | **Concept artist** | Draws fast idea sketches of characters, places and objects before they're built. ScreenSkills profile [vs]. | Illustrator of finished key art | C | A1 six sketches. |
| R26 | **2D artist** | Draws the finished flat art: sprites, backgrounds, tiles, icons. | Concept artist (ideas, not final assets) | I | A8 pixel editor. |
| R27 | **3D artist / modeller** | Builds 3D models of characters, props and places. | Animator (makes them move) | I | A14 clay sandbox. |
| R28 | **Character artist** | Specialises in 3D (or 2D) characters and creatures. | Concept artist | X | A32. |
| R29 | **Environment artist** | Makes the world's look: buildings, landscapes, props, foliage, skies. | Level designer; environment programmer (7.2) | I | A30 art pass on a greybox. |
| R30 | **Texture / material artist** | Paints the surfaces: rust, wood, skin. | 3D modeller | X | A17. |
| R31 | **Lighting artist** | Lights each scene for mood and to guide the eye. | Graphics programmer (builds the lighting tech) | X | A29. |
| R32 | **VFX artist** | Makes fire, magic, explosions and weather effects, mostly with particles and shaders. ScreenSkills: usually years as a game artist first [vs]. | Film VFX compositor; tech artist (broader) | I | A27 explosion builder. |
| R33 | **Technical artist** | The bridge between art and code: shaders, effects, tools, importing and keeping art running fast. ScreenSkills profile [vs]. | Graphics programmer; VFX artist | I | A34 half-the-particles challenge. |
| R34 | **UI artist** | Draws buttons, icons, health bars and menus. | UX designer | X | A33. |
| R35 | **Animator** | Brings characters to life with movement — walks, jumps, attacks, faces. ScreenSkills profile [vs]. | Rigger / technical animator (builds the puppet) | C | A24 bouncing-ball lab. |
| R36 | **Technical animator / rigger** | Builds the skeletons and controls animators use, and hooks animations into the game's state machines. ScreenSkills: starts in animation or programming [vs]. | Animator (performs); tech artist (broader) | X | A18 skeleton + A23 state arrows. |
| R37 | **Mocap performer / technician** | Actors in sensor suits and the crew who record their movement. | Voice actor | X | A25. |
| R38 | **Marketing / key artist** | Makes posters, store images and trailers' visuals. | Concept artist | X | A36. |

### 7.5 Audio family

| ID | Role | What they do (kid) | Not to be confused with | Tier | Aha |
|---|---|---|---|---|---|
| R39 | **Sound designer / audio designer** | Creates, records and edits sound effects and ambience, and places them in the game. ScreenSkills: may "edit, mix and master" and work with composers and actors [vs]. | Composer (music) | C | Foley + mix sliders. |
| R40 | **Composer** | Writes the game's music, often in layers that change with play. ScreenSkills: works with audio programmers and sound designers [vs]. | Sound designer | I | S6 adaptive layers. |
| R41 | **Audio director** | Leads the audio team and the game's overall sound. | Composer | X | — |
| R42 | **Voice actor / voice director** | Actors perform the lines; the director coaches them. | Writer | X | S7 three moods. |

### 7.6 Production and leadership

| ID | Role | What they do (kid) | Not to be confused with | Tier | Aha |
|---|---|---|---|---|---|
| R43 | **Producer** | Keeps the team on track: plans who does what by when, removes blockers, decides what to cut with the leads. ScreenSkills: usually start as assistant producers [vs, via 02]. | Creative director (vision); in film "producer" means funding | C | Cut the list (P9). |
| R44 | **Associate / assistant producer** | The entry-level producer: tracks tasks, runs meetings, chases updates. | — | X | Run a stand-up meeting with 3 characters. |
| R45 | **Project manager** | Manages schedules, tasks and risk; at some studios the same job as producer, at others a narrower planning role. | Producer (usually broader: team, scope and stakeholders) [k] | X | Gantt-chart drag. |
| R46 | **Product manager** | Focuses on the game as a product for players over time — features, player data, updates — common in mobile and live games. | Producer (making it), project manager (the schedule) [k] | X | Pick next update from player-data cards. |
| R47 | **Executive producer** | Oversees one or more games and the money, often the link to the publisher. | Producer | X | — |
| R48 | **Creative director / game director** | Owns the vision of the whole game; final say on "does this fit?". | Art director (just the look); producer | I | Pillars veto. |
| R49 | **Studio head / founder** | Runs the whole company. | Director | X | — |

**Distinction to teach:** *the director asks "is this the right game?"; the producer asks "will
we finish it on time?"; the project manager asks "is this task on schedule?"*

### 7.7 Quality assurance

| ID | Role | What they do (kid) | Not to be confused with | Tier | Aha |
|---|---|---|---|---|---|
| R50 | **QA tester / games tester** | Plays the game on purpose to find bugs, and writes reports so they can be fixed. Entry-level; a route into design, animation or programming, or a career in itself [vs]. | "Being paid to play games" (it's careful, repetitive detective work); playtester (gives fun feedback) | C | Bug bounty (P14–P15). |
| R51 | **QA analyst / QA lead** | Plans *what* to test, writes test plans, tracks bug trends and decides if the game is ready. | QA tester (runs the tests) | I | Write a 5-step test plan for a door. |
| R52 | **QA automation engineer / SDET** | Writes programs that test the game automatically, thousands of times. [vs] (SDET vs QA sources). | QA tester (manual) | X | A robot tester runs the level 100 times overnight; finds a 1-in-100 crash. |
| R53 | **Compliance / certification tester** | Checks the game against console makers' rules. | QA tester | X | P30. |
| R54 | **Localisation QA** | Checks translated text fits and makes sense. | Translator | X | P31. |
| R55 | **Playtester** | A (usually outside) player who gives feedback on fun and confusion, not bugs. | QA tester | I | Peer playtest (D23). |

### 7.8 After launch, and around the game

| ID | Role | What they do (kid) | Not to be confused with | Tier | Aha |
|---|---|---|---|---|---|
| R56 | **Community manager** | Talks with players online, shares news and brings player feedback back to the team. | Marketing | I | Answer 3 player comments politely, one angry. |
| R57 | **Live-ops designer / manager** | Plans events, seasons and updates for a game that's already out. | Producer | X | P28 weekend event. |
| R58 | **Data analyst** | Studies how players play (where they quit, what they use) to help the team decide what to change. | User researcher (watches individual players) | X | P33 heatmap. |
| R59 | **Localisation specialist / translator** | Translates and adapts the game for other languages and cultures. | Localisation QA | X | P31. |
| R60 | **Player support / trust & safety** | Helps players with problems and keeps online spaces safe (moderation). | Community manager | X | Sort 4 reports: bug, question, rude player, idea. |
| R61 | **Marketing / PR** | Tells the world about the game: trailers, store pages, press. | Community manager | X | B11 store page. |
| R62 | **Accessibility specialist** | Helps teams make games more people can play. | UX designer | X | D39 colour-blind filter. |

### 7.9 Distinctions kids should be able to make (quiz bank)

1. Game **designer** decides the rules ↔ gameplay **programmer** makes them work.
2. **Gameplay** programmer (this game's features) ↔ **engine** programmer (the toolbox all games use)
   ↔ **tools** programmer (buttons that make the team faster) ↔ **graphics** programmer (how it's
   drawn).
3. **Level designer** (layout/fun) ↔ **environment artist** (look) ↔ **environment/world
   programmer or tech artist** (world systems).
4. **Game** designer ↔ **systems** designer (rule-sets and numbers) ↔ **level** designer (places) ↔
   **narrative** designer (story through play) ↔ **UX** designer (clarity).
5. **Concept** artist (ideas) ↔ **2D/3D** artist (final assets) ↔ **environment** vs **character**
   artist (world vs people) ↔ **tech** artist (bridge to code) ↔ **VFX** artist (effects).
6. **Animator** (performs movement) ↔ **technical animator/rigger** (builds the puppet and wires it).
7. **Sound designer** (effects, ambience, mixing) ↔ **composer** (music).
8. **Creative director** (right game?) ↔ **producer** (done on time?) ↔ **project manager**
   (task on schedule?).
9. **QA tester** (finds and reports bugs) ↔ **QA analyst** (plans testing) ↔ **automation
   engineer** (robots that test) ↔ **playtester / user researcher** (is it fun and clear?).
10. **Community manager** (talks with players) ↔ **live ops** (runs events/updates) ↔
    **localisation** (other languages).
11. **Developer** (makes the game) ↔ **publisher** (funds, markets, sells it) ↔ **platform holder**
    (owns the store/console) — see B3.

---

## Domain 8 — The business and world of games (kid-appropriate)

Ratings: ESRB = E, E10+, T, M (17+), Adults Only 18+ (search snippet wrote "A", the letter mark is usually "AO" [k]), RP (rating pending); PEGI = 3, 7, 12, 16, 18 plus
content descriptors [vs] (https://www.esrb.org/ratings-guide/; https://en.wikipedia.org/wiki/PEGI).
Fab replaced the Unreal Marketplace in October 2024 and sells assets for Unity too [vs].

| ID | Concept | Tier | Kid definition | Aha | Needs |
|---|---|---|---|---|---|
| B1 | **Platforms** (PC, console, mobile, web, handheld, VR) | C | A platform is the kind of device a game runs on. | Drag your game onto 5 device silhouettes; each one asks for different controls. | T55 |
| B2 | **Stores and how games reach players** (Steam, console stores, App Store / Google Play, itch.io, web portals) | I | Stores are where players find, buy or download games; small indie games often start on itch.io or the web. | Make a mock store page for your game (title, 3 screenshots, one sentence). | B1 |
| B3 | **Developer vs publisher vs platform holder** | I | The developer makes the game, the publisher pays for and sells it, and the platform holder owns the store or console. | Three characters (studio, publisher, console maker) each want something from your game; negotiate a deal. | B2 |
| B4 | **Indie vs AA vs AAA** | C | Indie games are made by small, independent teams; AAA games are huge, expensive games made by hundreds of people. | Compare two credits screens: 3 names vs 3,000 names scrolling. | R12 |
| B5 | **First-party vs third-party** | X | First-party games are made by the console maker itself; third-party games come from other companies. | Sort 6 (fictional) games by who made them. | B3 |
| B6 | **Engines as businesses** (Unity, Unreal, Godot, in-house engines) | I | Studios pick an engine — some cost money or take a share of sales, Godot is free and open-source, and some big studios build their own. | Pick an engine for 3 studio scenarios (tiny web game, huge 3D game, custom racing tech). | E1 |
| B7 | **Age ratings** (ESRB, PEGI, IARC) | C | Age ratings tell families what's in a game and who it's right for. | Rate your own game with a ratings checklist; see which symbol it gets. | — |
| B8 | **Business models** (buy once, free-to-play, subscription, ads, DLC) | I | A business model is how a game makes money so the team can get paid. | Same game, 4 price models; which feels fairest to players? | B2 |
| B9 | **In-game purchases and loot boxes** (age-appropriate, critical) | I | Some games sell extras inside the game; random paid prizes (loot boxes) are controversial and restricted in some places. | Spot the difference: "buy this hat for 100 coins" vs "buy a mystery box"; discuss why ratings flag it. | B8, D47 |
| B10 | **Updates and live games** ("games as a service") | I | Many games keep changing after launch with new seasons, events and fixes. | Plan a "season 2" for your game on three cards. | P28 |
| B11 | **Marketing: trailers, screenshots, wishlists** | X | Marketing is telling people your game exists and why they'll love it. | Pick the best 3 screenshots from 10 and write a one-line hook. | B2 |
| B12 | **Reviews and feedback** | X | Reviews are players and critics sharing what they thought; good studios learn from them. | Read 4 fake reviews and pick one change to make. | P21 |
| B13 | **Esports** | X | Esports are organised video-game competitions with teams, tournaments and audiences. | Watch a replay with a "caster" commentating your own mini-game. | D19 |
| B14 | **Streaming and content creators** | X | Streamers play games live for audiences; their reactions can make a game famous. | Record a 30-second "let's play" of your own game. | — |
| B15 | **Modding and user-generated content** | X | Mods are player-made changes to a game; some games are built for players to create in (Roblox, Minecraft, Fortnite Creative). | Unlock "mod mode": other students can add one level to your game. | E3 |
| B16 | **Game events and community** (GDC, game jams, showcases) | X | Developers meet at events to share ideas, show games and learn — like GDC, the big conference for game makers. | Class showcase day framed as "the studio's booth at a games expo". | P23 |
| B17 | **Online safety and respectful play** | C | Online games need rules and tools (block, report, chat filters) to keep people safe and kind. | Design the "report player" button flow for your game. | T53 |
| B18 | **Careers and routes in** | I | There are many jobs in games, and people get in through school, self-taught projects, jams and entry roles like QA. | "Career map": click a role and see the path (e.g. QA tester → designer) — ScreenSkills career map. | R-series |
| B19 | **Game preservation / history** | X | Old games can disappear unless people save them — game history is worth protecting. | Play a 1970s-style Pong clone vs the kid's own game; list 3 things that changed. | — |

---

## (a) The backbone: ~60 Core concepts

Ordered roughly in a teachable sequence (each depends only on earlier items). Engine name hints
in brackets are Unity / Unreal / Godot.

**Studio & engine (12)**
1. E1 Game engine
2. E2 Editor vs the game
3. E3 Project
4. E4 World view [Scene view / Level Viewport / 2D-3D workspace]
5. E5 Play mode [Play / PIE / Run]
6. E7 Object list [Hierarchy / Outliner / Scene dock]
7. E8 Settings panel + E9 properties [Inspector / Details / Inspector]
8. E10 Project shelf + E11 asset [Project window / Content Browser / FileSystem]
9. E13 Message log [Console / Output Log / Output]
10. E16 Move / rotate / scale tools
11. E20–E21 Things made of parts [GameObject+Component / Actor+Component / Node tree]
12. E23 Templates [Prefab / Blueprint Class / instanced scene]

**Also core in the studio (5):** E22 Parent & child · E26 Scene/level · E41 Undo · E42 Save ·
E44 Build/export.

**How games work (16)**
13. T1 Frame
14. T2 FPS
15. T3 Lag / frame drops
16. T4 Game loop
17. T10 Pixel
18. T12 Rendering
19. T14 Sprite
20. T20 Coordinates
21. T21 Transform
22. T22 2D vs 3D
23. T23 Camera
24. T27 Game state (the notebook of numbers)
25. T28 Events ("when X, then Y")
26. T29 Bugs & crashes
27. T31 Input
28. T33 Physics · T35 Collider/hitbox · T37 Trigger (taught together)
29. T42 Spawning
30. T51 UI/HUD
31. T52 Save data
32. T55 Platforms & builds

**Design (15)**
33. D1 Mechanic/verb
34. D2 Rules · D3 Goal · D4 Win/lose (taught together)
35. D5 Obstacles
36. D6 Core loop
37. D9 Feedback
38. D10 Game feel / juice
39. D12 Difficulty curve
40. D23 Playtesting
41. D24 Level design
42. D25 Teach → test → twist
43. D34 Onboarding
44. D38 UX
45. D39 Accessibility
46. D41 Characters & NPCs
47. D44 Genres

**Art & sound (10)**
48. A1 Concept art · A3 Art style
49. A5 Silhouette/readability · A6 Colour meaning
50. A8 Pixel art
51. A19 Keyframes · A21 Sprite sheet · A22 Cycles
52. A24 Animation principles (squash & stretch, anticipation, timing)
53. A27 VFX & particles
54. S1 SFX · S4 Music · S11 Audio as feedback

**Production & world (10)**
55. P2 Prototype · P3 Iteration
56. P7 Milestones (alpha/beta/gold)
57. P8 Scope · P9 Cutting
58. P14 QA · P15 Bug report
59. P21 Feedback/critique · P22 Teamwork
60. P27 Shipping
61. B1 Platforms · B4 Indie vs AAA · B7 Age ratings · B17 Online safety

**Roles (Core tier):** R1 gameplay programmer, R12 game designer, R15 level designer, R25 concept
artist, R35 animator, R39 sound designer, R43 producer, R50 QA tester — plus the 7.9 distinction
quiz so kids meet the Important-tier roles as "not to be confused with".

(Grouped count: 61 numbered lines covering ~75 IDs; if a hard cap of ~50 is needed, merge the
"taught together" lines and drop E46/T3/D44/B4 to Important.)

---

## (b) Studio departments, each run by a character

A proposal. Each department owns a slice of the concept inventory and a set of roles, and its head
is a studio character who gives quests. Character names/personalities are placeholders.

| Department | Head (character sketch) | Roles inside | Owns concepts | Signature quest |
|---|---|---|---|---|
| **The Front Desk / Onboarding** | The AI mentor (studio guide) | — | E1–E5, E41, E42, T1–T4 | "Your first day": open a project, press Play, find the Play/Stop, undo a disaster. |
| **Design** | Lead designer — asks "but is it *fun*?" | Game, systems, level, narrative, UX designers; writer | D1–D47, E26 | "One-sentence game", "teach-test-twist". |
| **Engineering** | Lead programmer — literal-minded, loves "when X then Y" | Gameplay, engine, tools, graphics, AI, network, physics programmers; tech designer | T4–T57, E20–E33, E40 | "Be the computer", "the ghost who walks through walls" (layers). |
| **Art** | Art director — obsessed with silhouettes and palettes | Concept, 2D, 3D, character, environment, lighting, UI artists | A1–A17, A29–A36 | "Silhouette test", "art pass on a greybox". |
| **Animation & VFX** | Animator — bouncy, dramatic, everything squashes | Animator, technical animator, VFX artist, tech artist | A18–A28, A34, T58 | "Bouncing-ball lab", "explosion builder". |
| **Audio** | Sound designer — hears everything, carries a bag of celery | Sound designer, composer, VO | S1–S14 | "Foley kitchen", "eyes-closed test". |
| **QA** | QA lead — detective with a magnifying glass | QA tester, analyst, automation, playtester, user researcher | P14–P18, D23, P33, T29, E13, E40 | "Bug bounty", "can you reproduce it?" |
| **Production** | Producer — calm, clipboard, protective of the team's weekends | Producer, associate producer, project/product manager | P1–P13, P19–P26 | "Cut the list", "the delay card", postmortem. |
| **Publishing & Community** (unlocks near the end) | Community manager — friendly, reads every comment | Community, live ops, marketing, localisation, support | P27–P32, B1–B19 | "Ship it", patch notes, store page, ratings check. |
| *(Floor above)* **Creative director** | The studio founder — appears at milestones | Creative/game director | D20, D21, P7 | "Three pillars", milestone reviews (Alpha/Beta/Gold stamps). |

**Structure suggestions.**
- The **Door Problem** is a natural cross-department episode: one door, every head asks their
  question. It is the best single way to make the whole org chart concrete.
- Engine-panel names belong to the **front desk**, not a department: they're the building everyone
  works in. Reinforce them every time a department's quest uses a panel ("open the Inspector — in
  Unreal they call it the Details panel").
- The **environment question** (7.2) is best dramatised as a three-way hand-off: Design's level
  designer greyboxes → Art's environment artist dresses it → Engineering's world programmer makes
  the grass sway.

---

## (c) The 10 concepts most likely to confuse kids — and how to avoid it

| # | Confusion | Why it confuses | How to avoid it |
|---|---|---|---|
| 1 | **"Scene" means different things** — a Unity/Godot *Scene* is a level *or* a reusable template (Godot), the *Scene view* is a panel, and in everyday English a scene is part of a film | One word, three engine meanings | Use neutral words in the course ("level", "template", "world view") and introduce "Scene" only in the "In the real world…" cards, per engine. Never use "scene" loosely in course copy. |
| 2 | **Frame** (one picture of the game loop) vs **frame** (one drawing of an animation) vs "picture frame" / "iframe" | Same word, related-but-different ideas; animation frames often play at 8–12 per second while the game runs at 60 | Teach game frames first (T1 flipbook), then say explicitly: "an animation has its *own* frames — a walk might show 8 drawings while the game draws 60 frames." Show both counters side by side. |
| 3 | **Lag** — low FPS vs network ping | Kids say "lag" for both | The two-slider aha (T54): feel choppy vs rubber-banding and name them "frame drop" and "ping". |
| 4 | **Game AI vs generative AI** | The course *has* a generative AI mentor, so kids may think enemies "think" like the mentor | T49: inspect the guard's 4 rule cards. The mentor says "I'm a different kind of AI from the guard." |
| 5 | **Designer vs developer vs programmer** | "Game developer" is used for everyone and for programmers specifically; "designer" sounds like "artist" | A fixed studio vocabulary: "Everyone here is a game *developer*. Designers decide the rules; programmers build them; artists decide how it looks." Door Problem episode. |
| 6 | **Environment artist vs level designer vs "environment programmer"** | All sound like "makes the world" | 7.2's four-person table and the three-way hand-off quest. |
| 7 | **Sprite vs texture vs material vs shader** | Nested layers of "what it looks like" | Build them as a stack: sprite = flat picture (2D); texture = picture wrapped on a 3D thing; material = what the surface is like (shiny, rough) and which textures it uses; shader = the recipe the computer runs. Only sprite is Core; keep the rest Important/Extra. |
| 8 | **Template vs copy (prefab/blueprint vs instance)** | "If I change this one, why did (or didn't) the others change?" | E23/E24 aha: change the master → all change; change one copy → only it changes (override). Colour-code masters vs copies in the course's object list. |
| 9 | **Edit mode vs Play mode (changes don't stick)** | Every beginner loses work this way; it feels like the engine is broken | E6 aha on day one, deliberately. Tint the course editor a different colour during Play, as Unity lets you do [k]. |
| 10 | **y goes down vs up; x/y/z** | In many 2D tools (Godot 2D, Phaser, most screen coordinates) y increases downward; in Unity and in maths class it goes up; Unreal is z-up [k] | Teach coordinates with a treasure-map game, then a deliberate "surprise": flip the y arrow and show the course's arrow gizmo. Always show the axis arrows in the world view. |

**Honourable mentions:** *alpha/beta* (kids know "beta" from early-access games, which is
roughly right but not exactly); *QA tester = paid to play games* (reframe as detective work);
*bug vs feature* (some "bugs" are design choices — the bug zoo covers this); *collider vs the
picture* (the hitbox is not the sprite — the "show hitboxes" toggle fixes it); *Blueprint* (in
Unreal it means both visual scripting *and* a template class — introduce as "Unreal's template,
which can also hold visual instructions").

---

## Sources

**Engine and editor (official docs; seen in search, snippets confirmed [vs])**
- Unity Learn, Explore the Editor Interface — https://learn.unity.com/pathway/unity-essentials/unit/editor-essentials/tutorial/explore-the-editor-interface-1-1
- Unity Manual, Unity's interface — https://docs.unity3d.com/2023.1/Documentation/Manual/UsingTheEditor.html
- Unity Manual, Editor windows and views reference — https://docs.unity3d.com/6000.4/Documentation/Manual/editor-windows-views-reference.html
- Unity Manual, Hierarchy window — https://docs.unity3d.com/6000.6/Documentation/Manual/hierarchy-window.html
- Unity Manual, The Inspector window — https://docs.unity3d.com/2022.3/Documentation/Manual/UsingTheInspector.html
- Unity Manual, Game view reference — https://docs.unity3d.com/6000.3/Documentation/Manual/GameView.html
- Unity Manual, The Toolbar — https://docs.unity3d.com/2023.1/Documentation/Manual/Toolbar.html
- Unity Manual, Position GameObjects — https://docs.unity3d.com/Manual/PositioningGameObjects.html
- Unity Manual, Tags and Layers — https://docs.unity3d.com/Manual/class-TagManager.html
- Unity Manual, Asset Store — https://docs.unity3d.com/2022.2/Documentation/Manual/AssetStore.html
- Unity Docs, Build Profiles window reference — https://docs.unity3d.com/6000.0/Documentation/Manual/build-profiles-reference.html ; Unity Discussions, "What you need to know about Build Profiles in Unity 6" — https://discussions.unity.com/t/what-you-need-to-know-about-build-profiles-in-unity-6/1605803
- Unreal, Unreal Editor Interface — https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-editor-interface
- Unreal, Level Editor — https://dev.epicgames.com/documentation/en-us/unreal-engine/level-editor-in-unreal-engine
- Unreal, Level Editor Details Panel — https://dev.epicgames.com/documentation/unreal-engine/level-editor-details-panel-in-unreal-engine
- Unreal, Content Browser — https://dev.epicgames.com/documentation/en-us/unreal-engine/content-browser-in-unreal-engine
- Unreal, Playing and Simulating — https://dev.epicgames.com/documentation/unreal-engine/playing-and-simulating-in-unreal-engine
- Unreal, In-Editor Testing (Play & Simulate) — https://dev.epicgames.com/documentation/unreal-engine/ineditor-testing-play-and-simulate-in-unreal-engine
- Unreal, Placing Actors — https://dev.epicgames.com/documentation/unreal-engine/placing-actors-in-unreal-engine
- Unreal, Fab Window — https://dev.epicgames.com/documentation/unreal-engine/fab-window-in-unreal-engine
- Unreal, Packaging Your Project — https://dev.epicgames.com/documentation/unreal-engine/packaging-your-project
- Epic, "Fab, Epic's New Unified Content Marketplace, Launches Today!" — https://www.unrealengine.com/en-US/blog/fab-epics-new-unified-content-marketplace-launches-today
- Godot, First look at Godot's interface (title/summary only; fetch blocked) — https://docs.godotengine.org/en/stable/getting_started/introduction/first_look_at_the_editor.html
- Godot, Inspector Dock — https://docs.godotengine.org/en/stable/tutorials/editor/inspector_dock.html
- Godot, Groups — https://docs.godotengine.org/en/stable/tutorials/scripting/groups.html
- Godot, Exporting projects — https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html
- Godot, About the Asset Library — https://docs.godotengine.org/en/stable/community/asset_library/what_is_assetlib.html
- Godot, Introducing the Godot Asset Store — https://godotengine.org/article/introducing-the-godot-asset-store/
- Secondary (Godot dock names, Remote tree, F5/F6): Kodeco, "Godot 4: Getting Started" — https://www.kodeco.com/37604834-godot-4-getting-started ; DEV, "Learn Godot 4 by Making a 2D Platformer" — https://dev.to/christinec_dev/learn-godot-4-by-making-a-2d-platformer-part-1-project-editor-overview-1ap4 ; Medium, "Remote Scene Tree in Godot 4" — https://medium.com/@florian-trautweiler/remote-scene-tree-in-godot-4-af0bf4bc9d35 ; Godot issue #120943 — https://github.com/godotengine/godot/issues/120943
- Earlier engine concept map and its sources: `docs/rework/research/02-concepts-and-roles.md`

**Design**
- MDA — https://users.cs.northwestern.edu/~hunicke/MDA.pdf
- Juice It or Lose It — https://www.gdcvault.com/play/1016487/Juice-It-or-Lose
- Game feel — https://en.wikipedia.org/wiki/Game_feel
- Hayashida / kishōtenketsu — https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design ; https://www.gamedeveloper.com/design/the-structure-of-fun-learning-from-i-super-mario-3d-land-i-s-director
- The Level Design Book, Blockout — https://book.leveldesignbook.com/process/blockout ; Environment Art — https://book.leveldesignbook.com/process/production/art-pass
- Types of designers — https://www.gamedeveloper.com/design/types-of-designers ; https://gamedesignskills.com/game-design/types-of-game-designers/ ; DigiPen technical design — https://www.digipen.edu/showcase/news/digipen-game-design-disciplines-explained-technical-design

**Art, animation, audio**
- Twelve basic principles of animation — https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
- Vertical layering vs horizontal resequencing — https://www.thegameaudioco.com/making-your-game-s-music-more-dynamic-vertical-layering-vs-horizontal-resequencing ; middleware — https://www.thegameaudioco.com/game-audio-middleware-what-is-it-and-why-should-you-use-it

**Production and QA**
- Alpha, Beta, Gold — https://gamedevproducer.com/posts/what-is-a-game-milestone-alpha-beta-gold/
- Bug reports — https://bugnet.io/blog/how-to-write-good-bug-reports-for-game-development ; https://www.gamedeveloper.com/design/how-to-report-bugs
- QA vs SDET — https://www.mindfulqa.com/blog/sdet-vs-qa/
- IGDA DSS 2023 crunch figures — https://www.gamedeveloper.com/audio/crunch-and-extended-hours-both-down-in-latest-igda-dev-satisfaction-survey
- GDC 2026 State of the Game Industry — https://gdconf.com/article/gdc-2026-state-of-the-game-industry-reveals-impact-of-layoffs-generative-ai-and-more/ (adult context for the course author, not for kids: layoffs, generative-AI sentiment)

**Roles**
- ScreenSkills games job profiles — https://www.screenskills.com/job-profiles/browse/games/ ; games tester — https://www.screenskills.com/job-profiles/browse/games/quality-assurance/games-tester/ ; QA build engineer — https://www.screenskills.com/job-profiles/browse/games/quality-assurance/quality-assurance-qa-build-engineer/ ; technical artist — https://www.screenskills.com/careers/job-profiles/games/technical-art/technical-artist/ ; VFX artist — https://www.screenskills.com/job-profiles/browse/games/technical-art/visual-effects-vfx-artist/ ; games producer — https://www.screenskills.com/job-profiles/browse/games/production/games-producer-games/ ; lead games designer — https://www.screenskills.com/job-profiles/browse/games/design/lead-games-designer/ ; animator — https://www.screenskills.com/job-profiles/browse/games/animation/animator-games/ ; technical animator — https://www.screenskills.com/job-profiles/browse/games/animation/technical-animator/ ; concept artist — https://www.screenskills.com/job-profiles/browse/games/art/concept-artist-games/ ; music composer — https://www.screenskills.com/job-profiles/browse/games/audio/music-composer/ ; sound designer — https://www.screenskills.com/job-profiles/browse/games/audio/sound-designer-games/
- ScreenSkills games career map — https://www.screenskills.com/media/xskl5wdb/2756-games-career-map-interactive-feb25-final.pdf
- The Door Problem — https://lizengland.com/blog/the-door-problem/ ; IGDA archive — https://igda.org/resources-archive/the-door-problem-2014/
- Programmer specialisms — https://www.cgspectrum.com/career-pathways/game-programmer ; https://gamedesignskills.com/game-programming/programmer/
- Environment-adjacent job ads — https://builtin.com/job/senior-technical-artist-environment/3374615 ; https://alderongames.com/work-with-us/environmental-artist

**Business**
- ESRB ratings guide — https://www.esrb.org/ratings-guide/ ; PEGI — https://en.wikipedia.org/wiki/PEGI

## Gaps and cautions

- **No official page was fetched.** Every [vs] rests on a search snippet. Godot's own interface page
  could not be read; Godot dock names come from secondary tutorials plus the official "Inspector
  Dock" page title. Before student materials go out, check the Godot 4.x names (Scene dock, FileSystem
  dock, Output/Debugger, the Game workspace added in 4.4) and the Godot Asset Store/4.7 claim.
- **Engine names drift.** Unity renamed Build Settings to Build Profiles in Unity 6; Unreal's
  "World Outliner" became "Outliner" and Marketplace became Fab; Godot replaced TileMap with
  TileMapLayer [k] and dropped VisualScript [k]. The course should put engine names in one data
  file (one fact, one place) so they can be updated without touching the lessons.
- **"Environment programmer"** is a real phrase but not a standard title; section 7.2 is a reasoned
  synthesis from job ads plus [k], not a sourced definition.
- **Role boundaries vary by studio size.** At an indie studio one person may be designer, programmer
  and artist. The course should say so once, early ("at small studios people wear many hats").
- **Tiers, kid definitions and aha moments are proposals**, not research findings. Reading level was
  aimed at 6th grade by hand, not measured.
