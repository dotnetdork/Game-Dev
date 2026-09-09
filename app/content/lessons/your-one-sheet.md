---
title: Your One-Sheet
xp: 240
ai: full
checkpoint: true
summary: Fill in the page, and find out whether somebody else could build your game.
---

```zone
title: Your One-Sheet
intro: Six boxes. When they all have real answers in them, somebody else could build your game — which is the only test that matters.
reward: Designer badge
brief: >
  The student has just done three lessons on ideation: ideas are remixes, every game is one verb
  done well, scope is a skill, and a design doc fits on one page. They arrive with a sentence and a
  not-building list from the last checkpoint. The job here is the other four boxes, and "How you
  lose" is the one people skip — a game you cannot lose is one you cannot win, so ask about that
  box before any other. Push hardest on "What makes it mine": one twist, not three. If they name
  three, help them pick the one the game would stop being theirs without and move the rest down.
opener: >
  You have a sentence and a cut list already. Four boxes to go — and one of them is the box almost
  everybody leaves till last, which is a shame because it is the one that makes a game a game.
slots:
  - My game is
  - The one thing you do
  - How you win
  - How you lose
  - What makes it mine
prompts:
  My game is: One sentence somebody could repeat back to you.
  The one thing you do: Every game is one verb done well. Mario jumps. Minecraft digs. What is yours?
  How you win: What has to happen for somebody to say "I did it"?
  How you lose: If you cannot lose, you cannot win. What goes wrong?
  What makes it mine: The twist. One of them, not three.
board:
  - id: game
    say: My game
    at: [40, 40, 620, 300]
    holds: slots
  - id: cut
    say: Not building — next time
    at: [700, 40, 280, 300]
    hot: true
    collects: What I am NOT building
  - id: maybe
    say: Thinking out loud
    at: [40, 380, 940, 180]
goals:
  - say: Name the verb
    slot: The one thing you do
  - say: Say how you win
    slot: How you win
  - say: Say how you lose
    slot: How you lose
  - say: Name your one twist
    slot: What makes it mine
  - say: Every box answered
    slot: '*'
tools:
  - kind: readback
```
