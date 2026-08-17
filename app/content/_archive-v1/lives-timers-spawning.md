---
title: Lives, Timers & Spawning
xp: 400
ai: full
summary: Make things happen on a schedule.
---
A **timer** runs code on a schedule — perfect for spawning a new enemy every so often. A smaller delay means enemies appear faster (and the game gets harder). Drag the slider to feel it:

```run
// @slider: spawnEvery 200 1500 100 750
const seconds = 6;
const count = Math.floor((seconds * 1000) / spawnEvery);
console.log("At one every " + spawnEvery + "ms, about " + count + " enemies appear in " + seconds + " seconds.");
```
