---
title: The Systems of a Game
xp: 300
ai: full
summary: Input, physics, rendering, audio, and UI.
---
Under the hood a game is made of **systems**, each with one job:

- **Input** — reads the keyboard, mouse, or touches.
- **Physics** — moves things and detects collisions.
- **Rendering** — draws everything to the screen.
- **Audio** — plays music and sound effects.
- **UI** — the score, menus, and buttons.

The engine runs these for you every frame; you tell them what to do.

```quiz
type: mcq
prompt: Which system is in charge of detecting when two things touch?
options: [Audio, Physics, UI]
answer: 1
feedback:
  - "Audio plays sound."
  - "Right — physics handles movement and collisions."
  - "UI is the score and menus."
```
