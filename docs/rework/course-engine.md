# How the course runs — the AI is the course

2026-09-25. Jay's direction (`00-direction.md`, "the AI is the course"): the AI is essentially the
course, always steps ahead of the student, powered by an interconnected web of agents and subjects;
kids accidentally learn game-design concepts that are hard to forget, and win prizes they can use.
This is the model agreed in the interview. It is a design, not yet code.

## The four parts

1. **The concept web** — the map of what there is to learn. Every game-design concept is a node
   (gravity, feedback, core loop, difficulty curve…) recording what it needs first, which studio
   character teaches it, and its Unity / Godot / Unreal names. **Written by people.**
   *Seed in the prototype:* `app/content/vocabulary.yaml` is already a what-needs-what web, and
   `app/tools/check-vocab.js` fails if a lesson leans on an idea before it is taught. Reuse the idea.

2. **Quest outlines** — for each quest: which character gives it, the concept, the goal, and what
   counts as done. Short. **Written by people.** Everything *inside* a quest — dialogue, examples,
   adapting, building — the AI improvises.

3. **The director** — an AI that is never on screen. It reads the web and the kid's learner card,
   plans the next two or three quests, and re-plans after each one. Being ahead means it can plant
   things early (a hint in one quest that pays off two later). The kid gets **a glimpse** of the plan
   — what's next and a teaser ("the sound designer wants to meet you soon…") — never the whole map.

4. **The characters** — an array of agents: the mentor, the artist, the sound designer, the level
   designer and the rest. Each has a personality and its own part of the web. The director hands a
   quest to a character; the character runs that conversation (dialogue options + "say something
   else") and hands back.

All four read and update **the learner card** (`briefs/first-run.md` §6).

## Why it sticks

The director deliberately brings old concepts back inside new quests — the sound designer's quest
quietly needs the feedback idea from three quests ago. Recalling an idea beats rereading it (the
testing effect), and spacing beats cramming (the spacing effect); both are among the most robust
findings in learning science. The kid just experiences it as the next quest.

## Keeping it trustworthy

- **People own the web and the outlines**, so the course can't drift, contradict itself, or teach a
  wrong idea with confidence, and a teacher can see what's covered.
- **A checker sits between the AI and the child**, as in the prototype (`app/ai/quiz-check.js`,
  `app/ai/grade-check.js`: "reject, never repair"). Quest completion is judged against the outline's
  "what counts as done," not by the AI's say-so alone.
- **Serverless limits** (`CLAUDE.md`): no background work and a 60-second ceiling, so the director
  plans at the end of each quest, inside a request, not in the background.

## Prizes

Kids win prizes and use them for:
- **New powers for their tools** — a particle-effect maker, a level painter, a sound mixer, new
  things the AI can build.
- **Studio unlocks** — new departments, new characters, bonus quests.
- **Their desk and avatar** — cosmetics to show off.

Not chosen: art and sounds for their game as prizes. (The store's single art style is still "more
on that later.")

## Open

- The characters: names, personalities, how many at launch.
- The concept web's first version: which concepts, in which departments.
- What the prize currency is, and how prizes are won (per quest, per concept card, bonus
  challenges).
- How the teacher sees progress across 20 kids.
