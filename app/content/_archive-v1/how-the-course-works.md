---
title: How the Course Works
xp: 250
ai: full
summary: XP, Stars, unlocking, and the Gallery.
---
Finishing a lesson's challenge earns **XP** (which levels you up and ranks you on the leaderboard). Finishing a whole module earns **★ Stars**, which you spend on **assets** — sprites, backgrounds, and effects — in the Store.

Lessons unlock in order, so you always have a clear next step. When your game is done, you publish it to the **Gallery**.

```quiz
type: mcq
prompt: What do you spend Stars on?
options: [Buying whole games, Assets like sprites and backgrounds, Skipping lessons]
answer: 1
feedback:
  - "Not anymore — Stars buy pieces you add to your own game."
  - "Right — Stars unlock art and effects for your game."
  - "Lessons unlock by finishing the one before."
```

## Your challenge

```challenge
title: Fill the bar
task: Every lesson you finish pays out XP. This bar is stuck at zero — set `xp` to 100 and watch it fill.
code: |
  let xp = 0;               // change this

  ctx.fillStyle = "#eaf1f8";
  ctx.font = "15px Consolas";
  ctx.fillText("XP: " + xp + " / 100", 20, 70);

  ctx.fillStyle = "#0d2440";
  ctx.fillRect(20, 85, 260, 30);
  ctx.fillStyle = "#3ddc84";
  ctx.fillRect(20, 85, 260 * Math.min(xp, 100) / 100, 30);

  if (xp >= 100) win();
```
