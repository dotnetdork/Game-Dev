---
title: Launch Your Game
xp: 260
ai: full
checkpoint: true
summary: The last one. Fix the two worst things, watch somebody play it, put your name on it.
---

```zone
kind: build
title: Launch Your Game
file: config.js
intro: Everything in this course has been leading here. Four objectives, and the last one puts your game in the Gallery with your name on it.
reward: Published badge
brief: >
  The last zone in the course. The student has a finished-ish game, a one-sheet, and a list they
  wrote in the Ship It lesson under "Before it ships". The job is not to make the game good — it is
  to make it FINISHED, which is a different and much smaller thing. Hold them to two fixes, not ten:
  the whole lesson is that finishing is a decision, and a student who keeps fixing never presses
  publish. The playtest objective is the one they will want to skip and the one that teaches most —
  make them actually sit somebody in front of it and say nothing.
  Be warm here. This is the end of the course and they built a game.
opener: >
  Last one. Your game does not have to be good — it has to be finished, and those are different
  jobs. Four objectives, and the last one has your name on it.
goals:
  - say: Fix the two worst things
    brief: Two items off their "Before it ships" list actually fixed in the code. Two, not ten.
    check:
      - changed_at_least: 4
      - parses: true
  - say: Watch somebody play it, and say nothing
    brief: A line in design.md starting "They got stuck on:" with what they saw. Silence is the method.
    check:
      - contains:
          file: design.md
          text: 'They got stuck on:'
  - say: Fix the thing they got stuck on
    brief: One more change, aimed at what the playtester struggled with rather than at what the student wanted to build.
    check:
      - changed_at_least: 8
      - parses: true
  - say: Publish it
    brief: Gallery, from the top bar, with a name they are happy to have next to their own.
    check:
      - published: true
```
