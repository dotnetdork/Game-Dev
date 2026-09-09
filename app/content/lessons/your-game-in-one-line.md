---
title: Your Game in One Line
xp: 240
ai: full
checkpoint: true
summary: The first thing in this course that is yours rather than ours.
---

```zone
title: Your Game in One Line
intro: Four lessons on somebody else's game. This one is about yours — and it is the first thing here that is.
reward: One-Liner badge
brief: >
  This is the very first time the student has been asked what THEY want to make, and they have had
  no design vocabulary yet — four lessons on what an engine does, physics, assets and builds. So
  keep it to plain words. The starter game is a platformer, so anything shaped like a platformer is
  something they could really build. Their sentence does not have to be original or good; it has to
  be theirs and it has to be one sentence. The second box is the one that teaches the most: writing
  down what you are NOT making, before you have made anything, is the habit the whole course is
  trying to build.
opener: >
  Right — this board is yours, not ours. Two boxes, and neither of them needs you to know anything
  you have not been taught yet. I ask questions and I will not write your game for you.
slots:
  - My game is
prompts:
  My game is: 'One sentence. Try starting with "A platformer where" and finishing it.'
board:
  - id: game
    say: My game
    at: [40, 40, 420, 200]
    holds: slots
  - id: cut
    say: Not building — next time
    at: [500, 40, 300, 320]
    hot: true
    collects: What I am NOT building
  - id: maybe
    say: Ideas, unsorted
    at: [40, 280, 420, 250]
goals:
  - say: Say what your game is
    slot: My game is
  - say: Say what you are not building
    slot: What I am NOT building
tools:
  - kind: mixer
    title: Mix up three ideas
    into: My game is
    bases:
      - a platformer
      - a climbing game
      - a racing game
      - a collecting game
      - a hiding game
      - a delivery game
      - a farming game
      - a sword-fighting game
    twists:
      - but the floor disappears behind you
      - but you only get one life, ever
      - but you cannot stop moving
      - but you play as the thing that is chasing you
      - but everything you touch turns to gold
      - but the whole level is dark and you carry one torch
      - but time rewinds five seconds every time you die
      - but you cannot jump
      - but you get slower the more you carry
      - but somebody else is playing it at the same time and you can see them
      - but you have to teach a robot to do it instead of doing it
      - but the level is being built while you run through it
  - kind: whatif
  - kind: crazy8
```
