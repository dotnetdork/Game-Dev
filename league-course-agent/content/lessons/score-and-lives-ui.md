---
title: Showing Score & Lives on Screen
xp: 350
ai: full
summary: Text objects the player can actually see.
---
The player can't see a variable — you have to **draw** it. A text object shows the score, and you update it whenever the score changes with `setText`.

```quiz
type: predict
prompt: If score is 30, what does this show?
code: |
  let score = 30;
  console.log("Score: " + score);
options: ["Score: 30", "Score: score", "30"]
answer: 0
feedback:
  - "Right — the number is joined onto the text."
  - "The variable's value is used, not its name."
  - "The 'Score: ' label is included too."
```
