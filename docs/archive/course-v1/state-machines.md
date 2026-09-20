---
title: State Machines — Alive, Dying, Dead
xp: 350
ai: full
summary: A clean way to track "what mode is this thing in?"
---
A **state machine** tracks what *mode* something is in and the allowed ways to switch. A character might be **alive**, then **dying** (playing an animation), then **dead** (game over). You can only go alive → dying → dead, not skip around.

This keeps behavior predictable: each state knows what it's allowed to do.

```quiz
type: parsons
prompt: Order a character's states from start to finish.
lines:
  - Alive (playing normally)
  - Dying (hit — playing an animation)
  - Dead (game over)
distractors:
  - text: "Invisible forever"
    why: "That's not a normal game state — the character needs to end in 'dead'."
```

## Your challenge

```challenge
title: Alive, dying, dead
task: This player takes three hits and never actually dies. Finish the state machine — when `health` runs out, `state` should become "dead".
code: |
  let health = 3;
  let state = "alive";

  function hit() {
    health = health - 1;
    if (health <= 0) {
      // set state to "dead" here
    }
  }

  hit();
  hit();
  hit();

  ctx.fillStyle = "#eaf1f8";
  ctx.font = "16px Consolas";
  ctx.fillText("health: " + health, 20, 85);
  ctx.fillText("state:  " + state, 20, 117);

  if (state === "dead") win();
```
