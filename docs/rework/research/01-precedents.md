# Precedents: teaching game concepts to kids without syntax or walls of text

Research for the rework (`../00-direction.md`), 2026-09-24. Gathered by a research agent and kept
as returned, lightly edited for clarity.

**How reliable this is.** Web search worked but fetching full pages was blocked by the cloud
network policy, so no primary source was read in full. **[S]** = from search-result summaries of the
cited URL (fairly reliable, secondhand). **[I]** = inference. Vendor marketing numbers are flagged.
Treat each claim as a lead to check before it is quoted anywhere that matters (`CLAUDE.md`: verify
before claiming).

## Precedents

### 1. Nintendo Game Builder Garage — the closest match
- **[S] What it teaches:** visual programming. Each "Nodon" is a node (input, logic, output) with its
  own personality, which reviewers say keeps it from getting dry. Seven guided lessons each build a
  complete game in small steps. After each lesson a "Checkpoint": ~5 small puzzles set by a second
  guide, Alice (e.g. grab an apple without being able to move). "Alice's Guide" adds 36 short
  reference segments. ([GameSpot](https://www.gamespot.com/reviews/game-builder-garage-review-building-blocks/1900-6417690/),
  [Fandom: Checkpoints](https://game-builder-garage.fandom.com/wiki/Checkpoint_1),
  [Nintendo Life](https://www.nintendolife.com/reviews/nintendo-switch/game_builder_garage))
- **[S] Weaknesses:** lessons have you change values "without giving any reasoning"; many Nodon are
  never taught; the main guide's explanations are called "lengthy."
  ([VGC](https://www.videogameschronicle.com/review/game-builder-garage/))
- **Steal:** each concept is a *character*; every lesson ends in a *finished, playable game*; after
  the guided build, puzzle checkpoints where the kid solves a new problem with the same concept.
- **Avoid:** following steps you don't understand — every step needs a visible, playable "why." A
  chatty guide is the too-much-text problem again.

### 2. Gamestar Mechanic (E-Line Media / Institute of Play)
- **[S] What it teaches:** game design as systems thinking — rules, goals, mechanics, balance.
  Missions are **play, repair, or build**; repair missions hand you a *broken* game to diagnose and
  fix. One learning objective per mission. ([Common Sense](https://www.commonsense.org/node/2956561),
  [Fandom: Quest](https://gamestarmechanic.fandom.com/wiki/Quest))
- **[S] Evidence:** small study (16 urban middle schoolers): 5 of 6 focal students gained in systemic
  reasoning ([LearnTechLib](https://www.learntechlib.org/p/122704/)). Later "playfixing broken
  games" research: novices showed quick, sustained design thinking, especially spotting problems
  ([Emerald 2024](https://www.emerald.com/insight/content/doi/10.1108/ils-02-2024-0017/full/html)).
- **Steal:** **broken-game fix-its** — "this jump feels bad; why? Tell the AI how to fix it." Trains
  kids to diagnose and describe, which is exactly what directing an AI needs.

### 3. Pixar in a Box (Khan Academy + Pixar)
- **[S]** Short videos of real Pixar artists → interactive exercises → hands-on activity. Every
  concept framed as a production problem (grass in *Brave* uses parabolas; crowds in *WALL-E* use
  combinatorics). Middle/high school.
  ([Animation Magazine](https://www.animationmagazine.net/2015/08/khan-academy-launches-pixar-in-a-box/),
  [Pixar](https://www.pixar.com/pixar-in-a-box))
- **Steal:** frame concepts **through the job** ("animators call this squash and stretch"). Directly
  serves transfer to industry roles. **[I]** A 60–90 s "meet the role" clip or card per unit beats a
  paragraph.

### 4. Explorable explanations (Nicky Case, Bret Victor)
- **[S]** Victor coined the term: readers manipulate variables and see results live
  ([worrydream](https://worrydream.com/ExplorableExplanations/)). Case's method: make the reader love
  the question, start concrete, climb step by step, plant a "BUT…" twist every few minutes
  ([Case](https://blog.ncase.me/how-i-make-an-explorable-explanation/)). *Parable of the Polygons*
  teaches emergence through drag-and-drop mini-simulations
  ([Game Developer](https://www.gamedeveloper.com/design/using-systems-to-explain-systemic-problems-in-i-parable-of-the-polygons-i-)).
- **Steal:** one slider/toggle carries the whole idea, and the kid *touches it before reading about
  it*. "But what if…" twists as the pacing device.
- **Avoid [I]:** Case's pieces still carry a lot of prose — fine for adults, too much at 11.

### 5. "Juice It or Lose It" (Jonasson & Purho, 2012)
- **[S]** A dull grey Breakout clone gets effects added one at a time (squash, particles, trails,
  sound, screenshake) until it feels alive; the playable version has **a toggle per effect**.
  ([Rob Miller](https://roblog.co.uk/2024/03/juicy-games/), [talk](https://www.youtube.com/watch?v=Fy0aCDmgnxg))
- **Steal:** probably the best single lesson template: **same game, flip one thing, feel the
  difference.** No text needed. Then: "ask the AI to add screenshake to YOUR game."

### 6. Super Mario Maker 2, Dreams, LittleBigPlanet
- **[S]** Mario Maker 2's Yamamura's Dojo: 45 short lessons on level design ("surprise is fine if you
  give time to react," sketch on paper first) ([Mario Wiki](https://www.mariowiki.com/Yamamura%27s_Dojo)).
  Dreams: two guide characters, one concept at a time
  ([PlayStation](https://www.playstation.com/en-us/editorial/this-month-on-playstation/dreams-beginners-guide/)).
- **Steal:** design principles as one-sentence rules of thumb; the loop build → **someone else plays
  it** → react.
- **Avoid [I]:** Dreams is widely called deep but daunting — depth up front overwhelms.

### 7. Kodu, Bitsy, Scratch — constraint and tone
- **[S]** Kodu: icon-only **WHEN → DO** rules, ages 8+
  ([Microsoft Research](https://www.microsoft.com/en-us/research/project/kodu/)). Bitsy: 8×8 tiles,
  16×16 rooms, two colours per scene, no scripting — the constraints drive creativity
  ([opensource.com](https://opensource.com/article/22/1/bitsy-game-design)). Scratch: "low floors,
  high ceilings, wide walls" + remix ([Resnick](https://mres.medium.com/designing-for-wide-walls-323bdb4e7277)).
- **Steal:** **WHEN → DO is syntax-free game logic** and a natural sentence shape for prompting the
  AI ("WHEN the player touches lava, DO restart"). Deliberate constraints ("your game has 3 colours")
  give focus. Wide walls: every kid's game is different.

### 8. Code.org / Hour of Code, CodeCombat, Tynker
- **[S]** Minecraft Hour of Code study (n=104): kids who used the support system and text
  instructions did better; over two-thirds wanted to continue
  ([Springer 2023](https://link.springer.com/article/10.1007/s10639-023-12317-z)). CodeCombat vs.
  lecture: game group higher, not significantly ([ERIC](https://eric.ed.gov/?id=EJ1308871)).
- **Takeaway [I]:** these teach syntax, so less relevant — but *text isn't evil; it must be short and
  needed at the moment of use.*

### 9. Brilliant.org and Duolingo — lesson format
- **[S]** Brilliant asks the question *before* teaching, starts with the simplest version, instant
  feedback per answer ([About](https://brilliant.org/about/)); its "6× more effective" claim is
  **marketing, unverified**. Duolingo's bite-sized lessons and streaks cut churn a lot (reportedly
  47% → 28%); learning evidence is mostly limited to vocabulary
  ([T&F review](https://www.tandfonline.com/doi/full/10.1080/09588221.2021.1933540)).
- **Steal:** 3–5 minute units, one interaction per screen, instant feedback, a visible path.
  **Avoid:** leaning on streaks/XP — they drive engagement, not understanding.

### 10. Schell's lenses and MDA
- **[S]** Schell's deck: 116 cards, each a *question* plus an illustration
  ([Schell Games](https://schellgames.com/art-of-game-design)). MDA (Hunicke/LeBlanc/Zubek 2004):
  designers build mechanics first, players feel aesthetics first; "fun" split into 8 aesthetics
  (Sensation, Fantasy, Narrative, Challenge, Fellowship, Discovery, Expression, Submission)
  ([AAAI](https://aaai.org/papers/ws04-04-001-mda-a-formal-approach-to-game-design-and-game-research/)).
  No kid-specific classroom evidence found for either.
- **Steal [I]:** collectible **lens cards** in kid language ("Is it fair?", "What does it feel
  like?"); MDA's aesthetics as a "what kind of fun?" picker. Never name the framework.

### 11. Global Game Jam NEXT (ages ~12–17)
- **[S]** Jams as short as 4–6 hours, themed, with optional "diversifiers" (extra constraints in Art,
  Audio, Design, Narrative, Accessibility); browser-playable; teams ≤4
  ([GGJ Next](https://globalgamejam.org/ggjnext), [Diversifiers](https://globalgamejam.org/diversifiers)).
- **Steal:** theme card + optional challenge cards as the capstone format; diversifier categories map
  onto industry roles.

### 12. Kids "vibe coding" — a direct warning
- **[S]** CHI 2026, 41 children + 5 Scratch teachers: vibe coding *while learning a concept* "may
  weaken children's motivation to explore and cause confusion in concept construction." Kids
  struggled to **articulate goals**, **use system feedback**, and **evaluate outputs**
  ([ACM](https://doi.org/10.1145/3772318.3790366)).
- **Implication [I]:** "teach the concept, *then* build with AI" is the right order — but the prompt
  (sentence frames, WHEN→DO), the feedback (point at what changed) and the evaluation ("does it feel
  juicier? compare") all need scaffolding. An open chat box alone will fail.

### Supporting learning science
- **[S]** Productive Failure meta-analysis (Sinha & Kapur 2021, 53 studies): attempting a problem
  *before* instruction improves conceptual understanding and transfer; stronger from grade 6 up,
  younger learners need more scaffolding ([Sage](https://journals.sagepub.com/doi/10.3102/00346543211019105)).
  This age band sits right on that line.
- **Don't cite:** Minecraft Education's "87% improved problem-solving" and Roblox's "30% boost" come
  from low-quality aggregator pages.

## The strongest patterns, ranked

1. **Feel it before you name it.** Same tiny game, concept OFF then ON; the kid flips it; the name
   appears *after* they feel the difference. (Juice It, Case, Brilliant, Productive Failure.)
2. **Every lesson ends with the kid's own game changing.** A concept isn't done until the AI has put
   it into *their* game and they've played it. Directly fixes "course and building are
   disconnected." (Game Builder Garage, Scratch.)
3. **Fix the broken game.** Play a flawed game, name the problem, tell the AI the fix. Trains the
   diagnose-and-describe skills kids lack when directing AI. (Gamestar, playfixing, CHI 2026.)
4. **Scaffolded prompts, not a blank chat.** Tappable sentence frames (WHEN ___ DO ___; "make the ___
   feel more ___"); the AI shows what changed with a before/after replay; free text unlocks
   gradually. (Kodu, CHI 2026.)
5. **One idea per screen, 3–5 minute units, text only at the moment of need.** One interaction, one
   sentence at most, instant feedback; the rest behind "tell me more." (Duolingo, Brilliant.)
6. **Concepts as characters and collectibles.** Each concept has a face (Nodon) and becomes a
   collectible lens card the kid reuses on later games. (Schell.)
7. **Checkpoint puzzles for transfer.** 2–3 quick puzzles applying the concept somewhere new — the
   cheapest honest check that it stuck. (Game Builder Garage.)
8. **Frame through real roles.** "This is what an animator / sound designer / level designer does."
   (Pixar in a Box.)
9. **Twists as pacing.** "BUT what if…?" every few minutes. (Case.)
10. **Constraints as creative fuel.** Small palettes, one-room games, theme and challenge cards.
    (Bitsy, GGJ.)
11. **Someone else plays it.** Peer playtesting with a quick reaction. (Mario Maker, jams.)
12. **Name the fun, not the framework.** A "what kind of fun?" picker from MDA's aesthetics in kid
    words gives kids a goal to judge the AI's output against.

**Avoid overall:** guides that talk too much; steps without a visible reason; depth up front; streaks
and XP as the main motivator; an open AI chat during the *learning* phase.
