---
title: Sound Effects
xp: 350
ai: full
summary: Sound tells the player something happened.
---
A tiny sound on catch, hit, or win gives instant feedback your eyes might miss. In Phaser you load a sound, then `play` it at the right moment — usually inside the same function that handles the event (like `catchStar`).

```quiz
type: fillblank
prompt: Play a loaded sound named "ding".
code: "scene.sound.___('ding');"
answer: ["play"]
explain: "scene.sound.play('ding') plays the sound."
```
