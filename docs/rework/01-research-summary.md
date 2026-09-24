# What the research says — summary for the rework

2026-09-24. The one page to read; the evidence is in `research/`:
[01 precedents](research/01-precedents.md) · [02 concepts and roles](research/02-concepts-and-roles.md) ·
[03 kid UX and AI building](research/03-kid-ux-and-ai-building.md) ·
[04 app inventory](research/04-app-inventory.md) · [05 Impeccable critique](research/05-critique-current-app.md).

**Caveat on the sources.** The cloud session could search the web but not open pages, so most
citations are from search extracts, labelled in each report. Good enough to design from; check a
source before quoting it to the League.

## The student test, explained

Every student finding has a cause the critique found in the app (scored **20/40**):

| What the students did | Why (from the critique and the inventory) |
|---|---|
| Got bored; too many words | ~1,700 words per lesson; 1,100–1,900 words before the first thing to do. Demos sit still until dragged. |
| Didn't know where things were | 11 destinations and ~26 controls on the first screen; the left panel changes meaning on every tab. |
| Couldn't tell what to do | Nothing says "start here"; the promised first-run tour doesn't exist; practice steps sit in Learn while the work happens in Code/Play, so kids must remember them across a tab switch. |
| UI overwhelming | An adult IDE shell; the Play tab is a third empty console. |
| Course and building disconnected | The build happens in another tab, and the kid's game isn't on screen while they learn. |
| Widgets poor | Inert demos, off-screen feedback, and code-debugging labs. |

And one the students couldn't have named: **the AI — the new focal point — is hidden at the
Chromebook's resolution.** The layout only docks it at 1440px and wider (`ui.js:37`); school
Chromebooks are 1366.

## Where every source agrees

1. **The kid's game and the AI are the centre of the screen; the lesson happens beside them.** One
   screen, one job, one obvious "next." (Critique P0/P1; NN/g working memory; Game Builder Garage.)
2. **Feel it before you name it.** The same tiny game with the idea OFF, then ON; the kid flips it;
   the name comes after. Demos move on their own. ("Juice It or Lose It"; explorable explanations;
   Productive Failure research.)
3. **Three sentences, not three pages.** One idea per step, ~6th-grade reading level, the rest behind
   "tell me more." (NN/g teens and children; Mayer's segmenting and coherence.)
4. **The AI does build — but the kid makes the decision first.** Research on 10–17-year-olds found
   one-prompt-does-everything use tracked *worse* learning, while an AI that refuses gets ignored
   (Khanmigo). What works: concept-shaped choices before building ("how floaty? moon / normal /
   heavy"), the plan shown before it builds, what changed said in kid words with the game replayed at
   once, one-click undo, vague requests answered with a question in the concept's own words. A bare
   chat box during the *learning* part confused kids in a CHI 2026 study.
5. **Every lesson ends with the kid's own game changing.** A concept isn't finished until it's in
   their game and they've played it. (Game Builder Garage; Scratch's "wide walls".)
6. **Fix the broken game.** Hand them a game that feels wrong, let them name the problem and tell
   the AI the fix — it trains exactly the describe-and-diagnose skill directing an AI needs.
   (Gamestar Mechanic; the "playfixing" research.)
7. **Teach through the roles.** "This is what an animator does." (Pixar in a Box.) The concepts map
   cleanly onto Unity, Godot and Unreal — each concept card can carry the three engines' names for
   it, so the transfer is literally on the card.
8. **No decoration while learning; celebrate after the build.** Irrelevant on-screen extras
   measurably hurt learning (two meta-analyses). Stars/XP are secondary to watching the game change.
9. **Playable within 60 seconds.** No tour of panels, no reading first.
10. **Chromebook first:** 1366×768, big targets, no drag or right-click required.

## A candidate shape — a hypothesis to wireframe, not a decision

**One lesson = one "moment" of about 5–10 minutes, beside the kid's running game:**

1. **Feel it** — a tiny game plays; flip the one thing (floaty/heavy jump, no juice/juice). No text
   yet.
2. **Name it** — one sentence, the role who owns it ("level designers call this…"), and a collectible
   concept card with the Unity / Godot / Unreal names on the back.
3. **Build it** — the AI offers concept-shaped choices, shows its plan, builds it into *their* game,
   replays before/after. Undo is always one click.
4. **Prove it** — a quick checkpoint puzzle or a broken game to fix by describing the problem.
5. **Celebrate** — the peak of the lesson is their game visibly changed.

**The course spine:** units framed by roles, in the order the roles research suggests — designer
(core loop, win/lose) → artist (their look) → game feel/juice → programmer ("when X, then Y" rules)
→ level designer (templates, difficulty) → animator (states) → enemy AI → sound → UI/narrative →
playtesting/QA → producer/director capstone. A playable game of their own by the end of the first
session.

**What already exists and fits:** the engine layout, the Play tab's live-tuning sliders, the demos,
quiz feedback that explains, the Design board, the voice of the copy, the concept diagrams, and 47
short role/concept lessons (100–240 words) in `docs/archive/course-v1/`.

## Decisions for Jay before wireframing

1. **Does code disappear from view in this version?** (Code tab, console, file tree, labs.) The
   direction says no syntax; the critique asks whether they're Level 2 material.
2. **Stars/XP footer: keep, shrink, or drop?** The critique counts the footer as part of the liked
   layout; the research says rewards are secondary and distracting mid-lesson.
3. **The Design board:** keep it as the "plan your game" space? The critique rates it the best fit
   for the new direction.
4. **The AI's presence:** a named character with a face, or a clearly labelled panel?
5. **More detail on the student test:** how many kids, ages, what they did, anything they said. It is
   the project's first real evidence and should be written down while it's fresh.

## Next

1. Jay answers the decisions above.
2. `/impeccable shape` on the one screen that matters most — **the lesson moment beside the game**.
3. Grey-box wireframes of that screen and the first 60 seconds, reviewed before any code.
