---
title: "The Game Loop: create() and update()"
xp: 350
ai: full
summary: The heartbeat of every game.
---
Every Phaser game has two key functions:

- **create()** runs **once** when the game starts — build your world here (player, score, sprites).
- **update()** runs **every frame**, about 60 times a second — movement and checks go here.

This "run a little bit, over and over" cycle is the **game loop** — the heartbeat of the game.

```run
// Pretend this is the game loop running a few frames:
console.log("create(): set up the world");
for (let frame = 1; frame <= 3; frame++) {
  console.log("update(): frame " + frame);
}
```

```quiz
type: parsons
prompt: Order what happens when a game starts.
lines:
  - The game starts
  - create() runs one time to build the world
  - update() runs over and over, every frame
```
