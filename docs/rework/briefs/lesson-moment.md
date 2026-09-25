# Brief: the lesson moment

**Status: draft, parked 2026-09-25.** Shaped with `/impeccable shape`; not yet confirmed. Jay chose
to shape the first-run game first, since it comes before everything else. Revisit and confirm
before wireframing.

**Decided in the interview:** the kid invents their game in minute one; ideas are felt in the kid's
own game (a separate practice game only as a backup); the AI lives in the panel and points with
bubbles, as a named character; the left panel is the path, with the game's parts shown somewhere
too; rewards are a celebration + concept card *and* a small stars/XP bar; the AI adapts pace, words,
examples and how much it builds.

## 1. Who arrives and why
A 10–13-year-old, new to computers, in class on a Chromebook (1366×768), who already has their own
tiny game (invented in the first minute). Job: learn **one** game concept and see it land in *their*
game. Mode: Operate, with Experience at the peak.

## 2. What success looks like
The kid feels the idea, names it, puts it in their game by telling the AI, and plays the result —
~5–10 minutes, almost no reading. Proof: their game behaves differently and they hold a new concept
card.

## 3. Direction and structure
- **The kid's own game is always the centre.** Each idea is felt by switching it on and off in their
  own game. If their game lacks the mechanic, the AI first offers to add it; a separate practice game
  appears only if even that can't work.
- **Sequence:** feel it (bubble: "try jumping", a switch appears) → name it (one sentence + the role:
  "game designers call this gravity") → build it (the AI offers choices, shows its plan in a line,
  builds, replays) → prove it (a tiny puzzle or "fix what feels wrong") → celebrate (concept card;
  stars/XP tick up).
- **Peak:** their game visibly changing, with a before/after replay.
- **Look:** engine-studio feel (binding); visual design deferred — wireframe fidelity only.

## 4. Scope and boundaries
One screen, grey-box, 1366×768, the five steps as states. Not: first run, the course map, sign-in,
visual style. **Anti-goals:** paragraphs; code on screen; separate test pages; anything needing
drag, right-click or shortcuts; more than one bubble at a time.

## 5. States
The five steps · their game lacks the mechanic (the AI offers to add it) · the AI misunderstood (one
tap to undo) · the kid is stuck (the AI slows down, tries another angle) · the kid is fast (bonus
challenge) · the AI is unavailable (the game still works; the lesson waits politely).

## 6. Layout and interaction
- **Left — your path:** only the current unit and its few lessons; done and next.
- **Centre — their game** with play/pause/restart; under it **a row of part cards** (Player, Coin,
  Enemy…) — the engine's scene list. Tapping a card highlights that part and lets the kid ask the AI
  about it. *(Proposed, to meet "the game's parts should appear somewhere".)*
- **Right — the AI's home:** a named character; the whole conversation stays here; replies mostly by
  tapping choices, typing optional.
- **Bubbles:** one sentence, one at a time, never over the game during play, fade on their own, always
  also in the panel.
- **Bottom — small stars/XP:** still during the lesson, animates only at the celebration.
- **Undo:** one tap, beside anything the AI changed.

## 7. Not to be invented by the wireframe
The AI's name and face (placeholder) · what the AI remembers about a kid and where (privacy) · which
concept the example uses (gravity/jump unless Jay picks another) · how each kind of adapting shows on
screen · `PRODUCT.md` must be updated to the rework before visual design.
