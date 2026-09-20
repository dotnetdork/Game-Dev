---
title: Publish to the Gallery
xp: 500
ai: full
summary: Share your finished game with a link.
---
You made a game! Publish it to the **Gallery** so you can play it anytime and send a link to family and friends. Your game is saved so you can keep improving it later.

By default your game shows under a **handle** (not your full name) to keep things safe. Be proud — you designed it, you understood the code, and you directed it into existence.

```quiz
type: mcq
prompt: When you publish, what name shows on your game by default?
options: [Your full real name, A handle (nickname), Nothing at all]
answer: 1
feedback:
  - "Not by default — we keep real names private unless a parent opts in."
  - "Right — a handle keeps it safe and still lets you show it off."
  - "Your game does get a name to show — just a safe one."
```

## Your challenge

```challenge
title: The whole loop, in miniature
task: One last time, the loop you have been building all course — a star falls, the catcher catches it, the score goes up. Give the star a `speed` so it falls, and put `catcherX` under it. The star falls at x = 150.
code: |
  const speed = 0;        // how fast the star falls
  const catcherX = 0;     // where the catcher waits

  let starY = 0;
  let score = 0;
  let ticks = 0;

  function frame() {
    starY = starY + speed;
    ticks = ticks + 1;
    draw();

    if (starY >= 158) {
      if (catcherX > 130 && catcherX < 170) { score = 1; draw(); win(); }
      else { note("The star landed at 150 — the catcher wasn't there."); }
      return;
    }
    if (ticks > 300) { note("The star isn't falling yet."); return; }
    setTimeout(frame, 16);
  }

  function draw() {
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#f5b02e";
    ctx.fillRect(145, starY, 10, 10);
    ctx.fillStyle = "#2fd0b6";
    ctx.fillRect(catcherX - 20, 170, 40, 12);
    ctx.fillStyle = "#eaf1f8";
    ctx.font = "14px Consolas";
    ctx.fillText("Score: " + score, 12, 22);
  }

  function note(msg) {
    ctx.fillStyle = "#f5b02e";
    ctx.font = "13px Consolas";
    ctx.fillText(msg, 12, 45);
  }

  frame();
```
