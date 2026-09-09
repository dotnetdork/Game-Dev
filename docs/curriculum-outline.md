# Curriculum Outline — Game Development, Level 1 (SUPERSEDED)

> **This is the v1 outline — 10 modules, 47 lessons — and it is not what the course is.**
> The course shipped as 5 modules / 22 lessons (commit `0289fe1`) and is now 6 modules / 30
> lessons: Game Engines · **Concept Ideation** · Core Mechanics · Phaser Programming · Systems
> Architecture · Asset Design, each ending in a checkpoint on the student's own game.
> **`app/content/course.yaml` is the truth**, and its header comment explains the ordering.
> Kept because the research notes at the bottom are still the sourcing for that ordering, and
> because the two cut modules (team roles, the engine/language tour) are the clearest record of
> what was considered and dropped. The 47 lesson files are in `app/content/_archive-v1/`.


Audience: ages ~10–15, browser/Chromebook, fun-first, AI-assisted, build one real game.
Shape: literacy + concept minigames first, one guided capstone build at the end.
Names are clear/descriptive. Every lesson listed. Activity types vary to keep it interesting
(runnable cells with goals + sliders, MCQ, Parsons w/ distractors, predict-the-output,
fill-in-the-blank, find-the-bug).

Rough pacing note: with the new engines/roles/architecture modules this runs fuller than the
original 10–12h target — closer to **~13–14h**. Easy to trim (the literacy modules are light);
flag anything you want cut.

---

## Module 1 — Welcome & What You'll Build  *(~30 min · orientation/hook)*
1.1 What You'll Build — see real finished games; the goal of the course
1.2 A Tour of the Studio — Learn · Code · Play · the AI (Tutor vs Build)
1.3 Play & Tinker: Change One Thing — runnable cell + predict-the-output
1.4 How the Course Works — XP, Stars, unlocking, the Gallery

## Module 2 — What Makes Games Fun  *(~45 min · design literacy)*
2.1 The Ingredients of Fun — goal · feedback · reward  *(MCQ)*
2.2 Mechanics, Rules & the Core Loop  *(Parsons: order a core loop)*
2.3 Genres: Many Ways to Play  *(MCQ)*
2.4 Playtesting: Watching People Play

## Module 3 — Game Engines & the Languages Games Are Made Of  *(~45 min · literacy) — NEW*
3.1 What Is a Game Engine? — why engines exist, what they do for you
3.2 A Tour of the Big Engines — Unity, Unreal, Godot, Roblox, Scratch, Phaser
3.3 The Languages Games Are Written In — C++, C#, Lua/Luau, GDScript, Java, JavaScript  *(match engine → language)*
3.4 Case Study: How Minecraft Is Built — Java Edition vs Bedrock (C++); why two versions exist
3.5 Why We Use JavaScript + Phaser — 2D vs 3D, and what runs on a Chromebook

## Module 4 — Who Makes Games? Roles on a Team  *(~35 min · literacy) — NEW*
4.1 The People Behind a Game — overview of the team
4.2 Designers, Programmers & Artists — who does what
4.3 Animators, Sound & Level Designers
4.4 Producers & QA Testers — shipping, and how testers hunt bugs  *(find-the-bug intro)*
4.5 Where You + Your AI Fit In — you direct; the AI helps build

## Module 5 — How a Game Is Built: Systems & Architecture  *(~50 min · the "read/understand" ethic) — NEW*
5.1 The Game Loop — create() runs once, update() runs every frame
5.2 Scenes & Objects — where everything lives
5.3 The Systems of a Game — input · physics · rendering · audio · UI
5.4 Entities & Components: Thinking in Pieces — ECS, explained simply
5.5 Keeping Code Tidy — modular, isolated pieces (why we split things up)
5.6 State Machines — alive · dying · dead  *(Parsons: order the states)*

## Module 6 — Sprites & Movement  *(~70 min · hands-on)*
6.1 Putting a Sprite on Screen
6.2 Reading Input — keys & pointer
6.3 Moving with Velocity  *(slider cell: feel the speed)*
6.4 Challenge: Drive the Ship  *(modify-code challenge)*

## Module 7 — Collisions & Scoring  *(~70 min · hands-on)*
7.1 Detecting Overlaps
7.2 Variables & Keeping Score
7.3 Showing Score & Lives on Screen
7.4 Challenge: Catch the Stars  *(Parsons + modify)*

## Module 8 — Rules, Wins & Losses  *(~70 min · hands-on)*
8.1 Conditionals: If This, Then That
8.2 Lives, Timers & Spawning  *(slider cell)*
8.3 Game Over & Restart
8.4 Challenge: Add a Fail State  *(find-the-bug)*

## Module 9 — Juice & Game Feel  *(~55 min · hands-on)*
9.1 What Is "Juice"?
9.2 Tweens & Motion  *(slider cell)*
9.3 Screen Shake & Particles
9.4 Sound Effects
9.5 Challenge: Make a Hit Feel Great

## Module 10 — Build Your Game (Capstone)  *(~5–6 h · guided build)*
10.1 Choose Your Game — Platformer · Roguelike · Arcade · Collector
10.2 Plan It — sprites, rules & systems (use the architecture + roles thinking)
10.3 Build the Core Loop
10.4 Add Enemies & Challenge
10.5 Polish & Juice
10.6 Publish to the Gallery

---

## Notes / open decisions
- **Length**: ~13–14h as drawn. Trim candidates if we need 10–12h: merge M3+M4, or make M4 optional.
- **Capstone genres**: Platformer (Mario-like), Roguelike, Arcade survival, Top-down Collector — students pick one in 10.1; each needs a starter template.
- **Assessment variety** is woven throughout (goal-checked cells, sliders, Parsons+distractors, MCQ, predict-output, fill-in-blank, find-the-bug).

## Sources (research)
- Programming languages by engine / Minecraft: Index.dev "Top Programming Languages for Game Development"; Software Academy "What Coding Language Does Minecraft Use"; Wikipedia "Luau"; GDQuest scripting languages.
- Team roles: Pingle Studio "Key roles in a game development team"; gamedesigning.org "Video Game Development Teams"; CareerExplorer "Game Level Designer".
- Architecture/ECS/game loop: Guru99 "Entity Component System"; Apple GameplayKit "Entities and Components"; alain.xyz "Game Engine Architecture".
- Interactive-coding & Parsons pedagogy: ACM ICER 2024 "Distractors Make You Pay Attention"; ACM CHI 2021 "Adaptive Parsons vs Writing Code"; Kapor Foundation "Parsons Problem".
