---
title: State Machines — Alive, Dying, Dead
xp: 350
ai: full
summary: A clean way to track "what mode is this thing in?"
---
A **state machine** tracks what *mode* something is in and the allowed ways to switch. A character might be **alive**, then **dying** (playing an animation), then **dead** (game over). You can only go alive → dying → dead, not skip around.

This keeps behavior predictable: each state knows what it's allowed to do.

```quiz
type: parsons
prompt: Order a character's states from start to finish.
lines:
  - Alive (playing normally)
  - Dying (hit — playing an animation)
  - Dead (game over)
distractors:
  - text: "Invisible forever"
    why: "That's not a normal game state — the character needs to end in 'dead'."
```
