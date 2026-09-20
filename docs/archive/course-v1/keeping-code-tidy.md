---
title: Keeping Code Tidy — Modular & Isolated
xp: 350
ai: full
summary: Small, separate pieces are easier to change and fix.
---
Good game code is **modular**: each piece does one job and stays out of the others' way. If your "spawn a star" code is its own function, you can change how stars spawn without breaking how the player moves.

When you ask the AI for changes, tidy code means the AI (and you) can find and fix the right piece instead of untangling one giant mess.

```quiz
type: mcq
prompt: Why keep each part of the game in its own function?
options:
  - So you can change one part without breaking the others
  - So the game runs on Wi-Fi
  - So it uses more code
answer: 0
feedback:
  - "Exactly — isolation makes changes safe and easy."
  - "That's unrelated to code structure."
  - "Tidy code is usually *less* tangled, not more."
```
