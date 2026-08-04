---
title: Tweens & Motion
xp: 350
ai: full
summary: Smoothly change a value over time.
---
A **tween** smoothly moves a value from one number to another over some time — great for a score popping up, a menu sliding in, or a coin floating away. A shorter duration snaps; a longer one glides. Feel it:

```run
// @slider: durationMs 100 2000 100 500
console.log("A tween lasting " + durationMs + "ms feels " + (durationMs < 300 ? "snappy" : durationMs > 1000 ? "slow and floaty" : "smooth") + ".");
```
