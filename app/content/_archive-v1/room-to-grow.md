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
title: Room to Grow
xp: 240
ai: full
checkpoint: true
summary: Tidy your own game so the next thing you add does not break the last one.
---

```zone
kind: build
title: Room to Grow
file: config.js
intro: Your game is big enough now that the next thing is harder to add than the last one. That is the signal. Three objectives — none of them make your game do anything new, which is exactly why they are worth a checkpoint.
reward: Refactorer badge
brief: >
  Systems Architecture just ended: one state value instead of a pile of flags, things sharing a
  shape, parts announcing instead of reaching, and numbers living in data. The student's game has
  grown since the last checkpoint and almost certainly has loose numbers typed into lines and at
  least one function doing two jobs. Push on the honest question — if you added the thing at the top
  of your not-building list next week, how many files would you have to change? Then get them to
  lower that number by one. Insist on running it before and after: a tidy-up that changes behaviour
  is not a tidy-up, and that is the single most important idea in this zone.
opener: >
  Nothing you do in here will make your game do anything new. That is the point — this is the work
  that makes the next three weeks possible, and it never looks like progress on the day. Three
  objectives.
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
  - say: Get your loose numbers into CONFIG
    brief: Numbers typed straight into lines moved into CONFIG with names that say what they are.
    check:
      - file_changed: config.js
      - matches:
          file: config.js
          regex: 'CONFIG'
      - parses: true
  - say: Split something that was doing two jobs
    brief: A new named function pulled out of one that had grown, or a shape shared between two similar things.
    check:
      - function_added: true
      - parses: true
  - say: Say what you made room for
    brief: A line in design.md starting "Room for:" naming the thing off their not-building list and what they changed to make space.
    check:
      - contains:
          file: design.md
          text: 'Room for:'
```

## Conversation openers this lesson had in questions.yaml


### tutor.lessons

- How do I know when my code needs tidying up?
- What is a magic number, and why is it a problem?
- Why does moving a number into CONFIG make it draggable?
- What does it mean for a function to be doing two jobs?
- How can a tidy-up not change anything and still be worth doing?
- Which of the four tools from this module should I use on my game?
- How do I check I have not broken anything while tidying?
- Is it worth tidying code I am going to throw away?
- What does making room for something actually look like?
- Why is adding the eleventh thing harder than the tenth?

### coder.lessons

- Move every loose number in my game into CONFIG.
- Split the function that is doing two jobs into two functions.
- Pull the movement code out so two things can share it.
- Take the rules out of update and put them in their own function.
- Give my platforms and my coins the same shape so I can treat them alike.
- Turn my level layout into a list instead of lines of code.
- Show me which of my functions is the longest.
- Make it so adding a second kind of enemy would only touch one file.
- Replace the repeated code in my game with one function.
- Tell me where a new feature would be hardest to add right now.
