---
title: Build Your First Mechanic
xp: 240
ai: full
checkpoint: true
summary: Take one line off your one-sheet and make it actually run.
---

```zone
kind: build
title: Build Your First Mechanic
file: config.js
intro: You can read a variable, write an if, tell create from update, move a thing with the keyboard and read an error on purpose. That is enough. Four objectives, in order, in your own game.
reward: Mechanic badge
brief: >
  The Phaser module just ended: values and variables, decisions and repeats, create vs update,
  input/movement/collision, and reading an error. This is the first time the student writes code
  into their own game rather than into an exercise. Numbers first, because config.js is the cheapest
  possible change and it teaches that feel is a setting; then one real function, named, called from
  the right place. Keep the mechanic they pick SMALL — the commonest failure here is a student
  trying to build the whole twist off their one-sheet in one go. If their sheet says platforms
  vanish, the first version is one platform going transparent, not a fade system.
opener: >
  Right — this is your game now, not ours. Four objectives, one at a time, and I will not write any
  of it. Press play whenever you want to see where you are.
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
  - say: Make it feel like your game
    brief: Two numbers in CONFIG changed so the game moves the way their one-sheet describes.
    check:
      - config_changed: [moveSpeed, jumpPower, gravity, coinBounce]
  - say: Write a function for your mechanic
    brief: A new top-level function, named after what it does, for the smallest version of one thing on their sheet.
    check:
      - function_added: true
      - parses: true
  - say: Wire it into your game
    brief: game.js changed — the function is called from create() or update() so it actually runs.
    check:
      - file_changed: game.js
      - parses: true
  - say: Write down what you built
    brief: A line in design.md under their core loop starting "Built:" naming the function.
    check:
      - contains:
          file: design.md
          text: 'Built:'
```
