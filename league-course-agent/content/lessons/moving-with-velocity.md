---
title: Moving with Velocity
xp: 400
ai: full
summary: Velocity = how fast, in pixels per second.
---
With arcade physics you move a sprite by setting its **velocity** — how many pixels it travels each second. Drag the slider to feel how bigger numbers mean faster movement:

```run
// @slider: velocity 0 400 20 200
let x = 100;
for (let second = 1; second <= 3; second++) {
  x = x + velocity;
  console.log("After " + second + "s the player is at x = " + x);
}
```

Now a goal: change the number so the player ends past x = 700 after 3 seconds. (Hint: velocity 200 → 700.)

```run
// @goal: Make the final x be greater than 700
// @expect: 760
let x = 100;
const velocity = 220;
for (let s = 1; s <= 3; s++) x = x + velocity;
console.log("Final x = " + x);
```
