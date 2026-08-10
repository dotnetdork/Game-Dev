---
title: Scenes & Objects
xp: 300
ai: full
summary: Where everything in your game lives.
---
A **scene** is one screen of your game (a menu, a level). Everything in it — the player, enemies, score text — is an **object** that lives on the scene. In our code the scene is usually the variable `scene`, and we hang things off it like `scene.player` and `scene.score`.

```quiz
type: mcq
prompt: In our games, where do the player and score "live"?
options: [On the scene, In the console, On the internet]
answer: 0
feedback:
  - "Right — objects live on the scene."
  - "The console just shows messages."
  - "They live in your game, in memory, not online."
```
