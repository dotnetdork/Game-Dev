---
title: "Challenge: Add a Fail State"
xp: 500
ai: off
summary: Make the game end when you run out of lives — on your own.
---
**Challenge.** Make the game show **Game Over** and stop when lives reach 0.

The AI is **off** for this one. Read the code yourself and find the problem. Here's a version that never ends — which line is the bug?

```quiz
type: findbug
prompt: Lives reach 0 but the game never ends. Which line is wrong?
code:
  - "function loseLife() {"
  - "  lives = lives - 1;"
  - "  if (lives < 0) { endGame(); }"
  - "}"
answer: 2
explain: "It should be lives <= 0. With < 0, the game never ends exactly at 0 lives."
```

Fix it in your own code, test it in Play, then press Complete.
