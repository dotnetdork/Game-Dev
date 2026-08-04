---
title: Add Challenges
xp: 500
ai: off
summary: Add one obstacle the player must avoid — on your own.
---

**Challenge.** Add one obstacle the player has to avoid.

The AI is **off** for this lesson — read the existing spawn code and make the change yourself. You've got the tools. Think about the order of what has to happen when an obstacle appears:

```quiz
type: parsons
prompt: Order the steps to make a falling obstacle.
lines:
  - Pick a random x position at the top
  - Create the obstacle sprite there
  - Give it a downward velocity so it falls
  - When it leaves the screen, destroy it
```
