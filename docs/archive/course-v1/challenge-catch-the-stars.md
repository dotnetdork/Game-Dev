---
title: "Challenge: Catch the Stars"
xp: 450
ai: guided
summary: Wire up scoring when the player catches a star.
---
**Challenge.** Make the score go up by 1 every time the player catches a star, and show it on screen.

First, get the steps straight — drag them into order, and leave out the line that doesn't belong:

```quiz
type: parsons
prompt: Order the steps to score a caught star.
lines:
  - The player overlaps a star
  - Destroy the star
  - Add 1 to the score
  - Update the score text on screen
distractors:
  - text: "Restart the whole game"
    why: "You only want to score a point, not restart everything."
```

Then make it happen in the **Code** tab (AI is in guided mode) and press Complete.

## Your challenge

```challenge
task: The star is stuck at the top. Give it a fall speed so it drops to the paddle — that catches it and wins.
code: |
  let y = 10;
  const fallSpeed = 0;        // change this so the star falls
  function frame() {
    y = y + fallSpeed;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(120, 182, 60, 10);
    ctx.fillStyle = "#ffd23f"; ctx.fillRect(145, y, 12, 12);
    if (y >= 168) win();
    else requestAnimationFrame(frame);
  }
  frame();
```
