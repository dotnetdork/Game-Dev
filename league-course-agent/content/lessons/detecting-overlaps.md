---
title: Detecting Overlaps
xp: 350
ai: full
summary: Knowing when two things touch.
---
To know when the player catches a star, you ask physics to watch for an **overlap** between them and call your function when it happens:

`scene.physics.add.overlap(player, stars, catchStar, null, scene);`

When they touch, `catchStar` runs — that's where you add points and remove the star.

```quiz
type: mcq
prompt: What is the third argument (catchStar) in that overlap line?
options:
  - The function to run when they touch
  - The color of the star
  - The score
answer: 0
feedback:
  - "Right — it's the function called on overlap."
  - "There's no color here."
  - "Score is changed inside that function, not passed here."
```
