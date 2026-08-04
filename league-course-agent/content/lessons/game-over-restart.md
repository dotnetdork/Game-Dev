---
title: Game Over & Restart
xp: 350
ai: full
summary: Ending a run and starting fresh.
---
When lives hit zero you show a **Game Over** message and stop the action. Then you let the player **restart** — usually a click that reloads the scene so everything resets to the beginning.

```quiz
type: mcq
prompt: What's the cleanest way to restart a Phaser game after Game Over?
options:
  - Reload the whole browser tab
  - Restart the scene so everything resets
  - Delete the code
answer: 1
feedback:
  - "That works but it's heavy and slow."
  - "Right — restarting the scene resets it cleanly."
  - "Please don't delete your game!"
```
