---
title: "Challenge: Make a Hit Feel Great"
xp: 450
ai: full
summary: Add juice to one moment in your game.
---
**Challenge.** Pick one moment in your game (a catch, a hit, a win) and add at least two pieces of juice to it — for example a screen shake **and** a sound, or a particle burst **and** a score pop.

Ask the AI in **Build** mode to help, but *you* decide which moment and which effects.

```quiz
type: mcq
prompt: A good "juice" upgrade for catching a coin would be...
options:
  - A pop sound + the coin scaling up briefly as it vanishes
  - Ending the game
  - Removing the score
answer: 0
feedback:
  - "Yes — sound + a little animation sells the moment."
  - "That's a rule change, and a bad one!"
  - "That removes feedback, not adds it."
```

## Your challenge

```challenge
task: Add some screen shake. Set a shake amount above zero so the box jitters — a little juice wins this one.
code: |
  let frames = 0;
  const shakeAmount = 0;      // change this to add shake
  function frame() {
    const dx = (Math.random() - 0.5) * shakeAmount;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#e94b4b"; ctx.fillRect(130 + dx, 85, 40, 30);
    frames = frames + 1;
    if (shakeAmount > 0 && frames > 30) win();
    else if (frames <= 30) requestAnimationFrame(frame);
  }
  frame();
```
