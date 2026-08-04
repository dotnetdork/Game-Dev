---
title: Scenes & Objects
xp: 350
ai: full
summary: How a game is structured — scenes, objects, and how the pieces fit.
---

A Phaser game runs inside a **scene**. The scene has two key functions:

- `create()` runs **once** when the scene starts — build your world here.
- `update()` runs **every frame** (about 60 times a second) — movement and checks go here.

Put the lines in the order they run, from first to last:

```quiz
type: parsons
prompt: Order these from what happens first to what happens last.
lines:
  - The scene starts
  - create() runs one time to build the world
  - update() runs over and over, every frame
```

```tutor
context: create() runs once at the start; update() runs every frame after that.
prompt: Why would putting setup code in update() instead of create() cause problems?
```
