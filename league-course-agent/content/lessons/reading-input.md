---
title: Reading Input
xp: 350
ai: full
summary: Keys and pointer — how the player controls the game.
---
Input is how the player talks to the game. Phaser can read the **arrow keys**, letter keys, and the **pointer** (mouse or touch). In `create()` you set up the keys; in `update()` you check whether each one is held down.

```quiz
type: mcq
prompt: Checking "is the right arrow held down right now?" belongs in which function?
options: [create() — runs once, update() — runs every frame, neither]
answer: 1
feedback:
  - "create() runs once, so it can't keep checking."
  - "Right — held-down checks happen every frame in update()."
  - "It definitely goes somewhere — update()."
```
