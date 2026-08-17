---
title: Where You + Your AI Fit In
xp: 300
ai: full
summary: You're the designer/director; the AI helps you build.
---
In this course, **you** are the designer and director. The **AI** is your programmer-helper: you decide *what* the game should do and explain it clearly, and the AI helps write the code. The better you understand the code, the better you can direct it — and fix it when it's wrong.

That's a real modern skill: knowing what you want and being able to explain it precisely.

```quiz
type: mcq
prompt: In this course, whose job is it to decide what the game should do?
options: [The AI decides everything, You decide; the AI helps build it, Nobody decides]
answer: 1
feedback:
  - "The AI helps, but it shouldn't make your design choices."
  - "Right — you direct, the AI assists."
  - "Someone has to make the calls — that's you!"
```

## Your challenge

```challenge
title: You're on QA today
task: A tester filed this bug — "the scoreboard always reads 0, even after you score." One line is wrong. Find it and fix it so the score reads 7.
code: |
  let score = 0;

  function addPoints(points) {
    score + points;          // a tester says this line is the problem
  }

  addPoints(7);

  ctx.fillStyle = "#eaf1f8";
  ctx.font = "18px Consolas";
  ctx.fillText("Score: " + score, 20, 100);

  if (score === 7) win();
```
