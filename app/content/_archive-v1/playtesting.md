---
title: Playtesting — Watching People Play
xp: 300
ai: full
summary: The fastest way to find what's fun and what's broken.
---
**Playtesting** means watching someone else play your game *without helping them*. Where they get confused or bored tells you what to fix — usually faster than guessing.

The rule: don't explain, just watch and take notes. If they don't understand it without you, players at home won't either.

```quiz
type: mcq
prompt: During a playtest, what should you mostly do?
options: [Explain how to play as they go, Watch quietly and take notes, Play it for them]
answer: 1
feedback:
  - "If you have to explain it, that's a clue it needs fixing."
  - "Exactly — quiet observation shows you the real problems."
  - "Then you learn nothing about how *they* experience it."
```

## Your challenge

```challenge
title: Close the loop
task: A core loop without a reward stops being fun. Catching a star currently gives you nothing — set `pointsPerStar` so that catching 5 stars adds up to exactly 10 points.
code: |
  const pointsPerStar = 0;  // change this
  let score = 0;

  for (let star = 1; star <= 5; star++) {
    score = score + pointsPerStar;
  }

  ctx.fillStyle = "#eaf1f8";
  ctx.font = "16px Consolas";
  ctx.fillText("Stars caught: 5", 20, 80);
  ctx.fillText("Score: " + score, 20, 112);

  if (score === 10) {
    win();
  } else {
    ctx.fillStyle = "#f5b02e";
    ctx.fillText("Needs to be 10", 20, 144);
  }
```
