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
