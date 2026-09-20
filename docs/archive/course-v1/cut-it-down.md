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
title: Cut It Down
xp: 240
ai: full
checkpoint: true
summary: Rewrite your page now you know what a loop, a reward and a difficulty curve are.
---

```zone
title: Cut It Down
intro: Your page was written by somebody who knew less than you do now. Time to say it in the words you have learned — and to cut it to something you can actually build.
reward: Scope Cutter badge
brief: >
  Five lessons of Core Mechanics just happened: the core loop, feedback, difficulty and flow, risk
  and reward, progression. The student has the vocabulary now, and their page does not use any of
  it. Two jobs here. First, get the core loop out of them in three parts — you do X, the game
  answers with Y, and Z sets up the next go — and check the loop CLOSES. A loop with nothing
  setting up the next go is a game that stops after one turn, and finding that out on paper is free.
  Second, cut. They have almost certainly written down more game than ten weeks holds. Aim them at
  one verb, one obstacle, one reason to keep going, one way to lose, and make sure everything they
  cut lands in the not-building box rather than being deleted.
opener: >
  You have words now that you did not have when you wrote this page — loop, feedback, difficulty,
  risk. So let us start with the big one: what is the loop in your game? Say it as three things,
  one after the other.
slots:
  - My core loop
  - The one thing you do
  - How you lose
  - What makes it mine
prompts:
  My core loop: Three parts, one sentence. You do X, the game answers with Y, and Z sets up the next go.
  The one thing you do: Still one verb? If you have collected a second one, this is where it gets cut.
  How you lose: Now you know about difficulty and fairness — is losing the player's fault, or the game's?
  What makes it mine: One twist. If there are still three here, two of them belong on the right.
board:
  - id: game
    say: The game I am building
    at: [40, 40, 440, 300]
    holds: slots
  - id: building
    say: Going in
    at: [520, 40, 250, 300]
    budget: 10
    collects: What I am building
  - id: cut
    say: Not building — next time
    at: [810, 40, 250, 300]
    hot: true
    collects: What I am NOT building
  - id: loose
    say: Everything I want
    at: [40, 380, 1020, 190]
goals:
  - say: Write your core loop in three parts
    slot: My core loop
  - say: One verb, not two
    slot: The one thing you do
  - say: One twist, not three
    slot: What makes it mine
  - say: Say what you cut
    slot: What I am NOT building
  - say: Every note written
    slot: '*'
tools:
  - kind: readback
```

## Conversation openers this lesson had in questions.yaml


### tutor.lessons

- How do I write my core loop as one sentence?
- What does it mean for a loop to close?
- How do I know if my loop is any good before I build it?
- Why cut things now rather than when I run out of time?
- What if everything on my page feels essential?
- How do I pick which verb to keep?
- Is one obstacle really enough for a whole game?
- What is the difference between cutting and giving up?
- Why write down what I cut instead of just deleting it?
- How will I know later whether the cut was right?

### coder.lessons

- Comment out everything that is not my one verb.
- Make the coin respawn so my loop actually closes.
- Add the thing that sets up the next go in my loop.
- Remove one feature and show me what still works.
- Add a comment in game.js writing out my core loop in three parts.
- Make the game end instead of carrying on forever.
- Cut the number of coins down to one.
- Tell me which part of my code is doing more than my page asks for.
- Take out the second kind of obstacle.
- Show me the fewest lines that would still be my game.
