---
title: Sprites & Movement
xp: 400
ai: full
summary: Put a character on screen and make it move.
---

A **sprite** is a picture you can move and collide. With arcade physics you move it by setting a **velocity** (pixels per second).

```run
let x = 100;
const velocity = 50;
for (let frame = 1; frame <= 4; frame++) {
  x = x + velocity;
  console.log("Frame " + frame + ": player x = " + x);
}
```

```quiz
type: mcq
prompt: If a sprite's velocity is 200, roughly how far does it move in one second?
options:
  - 2 pixels
  - 20 pixels
  - 200 pixels
answer: 2
```
