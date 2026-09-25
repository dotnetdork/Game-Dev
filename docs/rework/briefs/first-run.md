# Brief: the first-run game ("Let's make you a game")

**Status: draft, "really close" (Jay, 2026-09-25) — still being fleshed out.** Shaped with
`/impeccable shape`. Comes before the lesson moment (`lesson-moment.md`). Not yet confirmed; don't
wireframe until it is.

## 1. Who arrives and why
A 10–13-year-old signing in for the first time, possibly new to computers and unsure what this is.
Mode: Experience — inside a playful conversation, not a form.

## 2. What success looks like
Within 3–5 minutes: the kid has **played their own tiny game**, met the AI character, knows where
the path, the game and the AI live, and the AI holds a first **learner card**. Proof: their hands on
their own game before five minutes.

## 3. Direction and structure
- **The engine builds itself around them.** Starts nearly empty — the AI character, one bubble, big
  tap targets. Answers unlock the layout piece by piece; by the end they're in the full engine and
  already know each part. Replaces the tour the old app never had.
- **Discovery, not labels (Jay).** Open, playful questions; the AI infers and **reflects back** —
  "So, like Mario?" [Yes!] [Not quite]:
  - kinds of fun from situations ("You find a locked door. Do you… hunt for the key / smash it /
    sneak round the back / get a friend?");
  - favourite games drawn out ("What's a game you could play all day? What's the best bit?" →
    "Sounds like you love building — like Minecraft?");
  - role interest from action (a tiny game missing colours, sound, a good rule — what they fix first
    hints artist / sound designer / designer); never "which job interests you?";
  - computer comfort noticed quietly (typing a nickname, clicking targets, skipping bubbles).
- **Sequence (~8 beats):** hello + nickname → 2–3 situation questions → pick a hero → what you do
  (jump / dodge / collect) → a goal and a danger → "Building your game…" as the viewport assembles →
  **they play it** → "That's YOUR game. Want to make it even better?" → the first lesson.
- **Peak:** their game appearing in the middle of the engine, responding to their keys.

## 4. Scope and boundaries
One flow, ~8 beats, grey-box at 1366×768. **Anti-goals:** forms; anything that looks like a survey
or test; more than one sentence to read at a time; asking for real name, age or school; drag or
shortcuts.

## 5. States
Slow typer (choices appear instead) · "not quite" after a reflect-back (the AI asks another way) ·
picks nothing (the AI suggests after a pause) · returning kid ("welcome back") · AI unavailable (a
built-in scripted version still gets them to a playable starter game).

## 6. The learner card
Evolves as they go (Jay); the kid and teacher can see and reset it.
- **Their picks:** favourite games/characters, kinds of fun, first-game ingredients, nickname.
- **Noticed from the opener:** reading, typing and clicking comfort; pace; how many choices suit
  them; curiosity.
- **Learned during lessons:** tries, undos, AI misunderstandings, roles they liked, cards revisited,
  drop-off points.
- **Never:** real name, birthday, school, location, photos, voice, stored chat transcripts.
- Stored in the browser and the League's own storage; the AI gets only the fields a request needs
  (COPPA; `docs/child-privacy-brief.md`; `../research/03-kid-ux-and-ai-building.md`).

## 7. Not to be invented by the wireframe
The AI's name, face and voice · the exact situation questions (content) · how the "what I know about
you" card looks · whether a teacher can pre-set anything · the scripted fallback's starter game.
