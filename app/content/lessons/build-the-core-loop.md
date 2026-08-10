---
title: Build the Core Loop
xp: 400
ai: guided
summary: Get the fun part working first.
---
Build the **core loop** before anything else — the one thing the player does over and over (jump across a gap, dodge a block, grab a coin). If the core loop is fun, you have a game. Everything else is polish.

Work with the AI in **Build** mode, but describe the loop precisely: what the player controls, what they interact with, and what makes the score change.

```run
// Sketch your core loop in words first, then build it:
const loop = ["player moves", "something happens", "score changes", "repeat"];
console.log("My core loop: " + loop.join(" -> "));
```
