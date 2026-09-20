<!--
  ARCHIVED 2026-09-09. This was a CHECKPOINT - a gated end-of-module lesson that opened a building
  zone instead of a page. The whole checkpoint concept was removed: it was the most-built and least
  validated feature in the app, and gating a module behind a board turned out to be the wrong shape.
  What replaced it is a persistent DESIGN tab - the same board, always open, iterated across the
  whole course instead of six times behind a gate.
  Kept because the zone specs below are real design work: the board layouts, the region roles, the
  objective checks and the coach briefs are all worth mining if checkpoints come back in another
  form. Nothing loads this file - the app only reads what course.yaml lists.
-->
---
title: Your Game in One Line
xp: 240
ai: full
checkpoint: true
summary: The first thing in this course that is yours rather than ours.
---

```zone
title: Your Game in One Line
intro: Three lessons on somebody else's game. This one is about yours — and it is the first thing here that is.
reward: One-Liner badge
brief: >
  This is the very first time the student has been asked what THEY want to make, and they have had
  no design vocabulary yet — three lessons on what an engine does, assets and physics. So
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
  - kind: readback
```

## Conversation openers this lesson had in questions.yaml


### tutor.lessons

- What makes a good one-sentence description of a game?
- How do I start the sentence if I have no idea what I want to make?
- Is a platformer a boring choice?
- Does my idea have to be original?
- What if my sentence is really long?
- Where is this file saved, and can I lose it?
- What if I change my mind about my idea later?
- Why does it matter that somebody else understands my sentence?
- Do I have to say how the game looks, or just what you do in it?
- Is it a problem if my idea sounds like a game that already exists?

### coder.lessons

- Add a comment at the top of config.js saying what my game is.
- Rename the player variable to something that fits my idea.
- Change the background colour to suit the game I described.
- Show my game's name on the screen when it starts.
- Make one change to config.js that matches my sentence.
- Put my one-line idea in a comment in game.js.
- Change the coin count so it matches what I wrote down.
- Make the player start somewhere else on the screen.
- Give the score text a label that fits my game.
- Make the game window a different shape.
