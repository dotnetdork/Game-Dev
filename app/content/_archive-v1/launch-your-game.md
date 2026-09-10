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
board:
  - id: done
    say: Done
    at: [40, 40, 230, 460]
    objectives: done
  - id: now
    say: Now
    at: [310, 40, 250, 460]
    objectives: now
    hot: true
  - id: ahead
    say: Still ahead
    at: [600, 40, 230, 460]
    objectives: ahead
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

## Conversation openers this lesson had in questions.yaml


### tutor.lessons

- How do I know when my game is finished?
- What if I find ten things wrong and can only fix two?
- Why do I have to stay quiet while somebody plays it?
- What if the person playing it hates it?
- Is my game good enough to publish?
- What should I call it?
- Can I change it after I publish it?
- What if I run out of time before it is done?
- How do real studios decide it is finished?
- Who is going to see this?

### coder.lessons

- Show me the two most obviously broken things in my game.
- Add a title screen with my game's name on it.
- Make the game restart properly instead of needing a reload.
- Find anything in my code that would only work on my computer.
- Tidy up the comments so somebody else could read this.
- Make the first ten seconds of my game easier.
- Tell me which part of my game a new player would not understand.
- Take out the thing I never finished.
- Add a message when the player wins.
- Check every asset my game uses is one I actually own.
