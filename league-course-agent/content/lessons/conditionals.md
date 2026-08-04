---
title: "Conditionals: If This, Then That"
xp: 350
ai: full
summary: Make the game decide.
---
A **conditional** lets the game make a decision: *if* something is true, *then* do something. "If lives reach 0, then it's game over."

```run
let lives = 1;
lives = lives - 1;
if (lives <= 0) {
  console.log("Game over!");
} else {
  console.log("Lives left: " + lives);
}
```

```quiz
type: predict
prompt: What prints if lives starts at 3 and you lose one?
code: |
  let lives = 3;
  lives = lives - 1;
  if (lives <= 0) { console.log("Game over!"); }
  else { console.log("Lives left: " + lives); }
options: ["Game over!", "Lives left: 2", "Lives left: 3"]
answer: 1
feedback:
  - "3 - 1 = 2, which is not <= 0."
  - "Right — 2 lives left, so the else branch runs."
  - "You lost one, so it's 2, not 3."
```
