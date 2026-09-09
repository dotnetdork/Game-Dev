---
title: Build Your First Mechanic
xp: 240
ai: full
checkpoint: true
summary: Take one line off your one-sheet and make it actually run.
---

You can read a variable, write an `if`, tell `create` from `update`, move a thing with the keyboard,
and read an error message on purpose. That is enough to build something.

So build something. Not the whole game — **one line off your one-sheet**, running, in your own
project.

```yourturn
title: Change the numbers until it feels like your game
task: Before you add anything, make what is already there feel right. Your one-sheet says something about how your game moves; the settings file is where that lives.
steps:
  - Open the Code tab and open `design.md`. Read your verb and your core loop again.
  - Open `config.js`. Every number in there changes how the game feels.
  - 'Change at least two of them so the game matches your page: heavier, floatier, faster, more sluggish — whatever your sentence implies.'
  - Press Run and play it for a minute. Keep changing numbers until it feels like the game you described rather than the one we gave you.
  - Add a line under your core loop in `design.md` starting `Feel:` describing what you settled on.
reward: Feel Tuner badge
check:
  - config_changed: [moveSpeed, jumpPower, gravity, coinBounce]
    hint: None of the numbers in `config.js` have moved yet. Change at least two and press Run.
  - contains:
      file: design.md
      text: 'Feel:'
    hint: Add a line starting `Feel:` to `design.md` saying what you settled on and why.
  - parses: true
    hint: Something in your project no longer parses — check the console and fix it before this counts.
example: 'Feel: heavy and committed. gravity 700, jumpPower 300 — you cannot change your mind mid-jump.'
```

Numbers are the cheapest change there is, which is exactly why you do them first. Now the part
that is new code.

```yourturn
title: Build one thing off the page
task: 'Pick the smallest real item from your one-sheet — one rule, one obstacle, one behaviour — and make it work. Write it as its own function so you can find it again.'
steps:
  - Read your one-sheet and pick the **smallest** thing on it that is not already in the game.
  - Open the Code tab and add a new function for it. Give it a name that says what it does, like `movePlatforms` or `chaseThePlayer` — not `thing1`.
  - 'If it has to happen every frame, call it from `update()` in `game.js`. If it happens once when the game starts, call it from `create()`.'
  - Press Run. Expect it to be wrong the first time — that is what the console is for.
  - When it works, add a line to `design.md` under your core loop starting `Built:` naming the function.
reward: Mechanic badge
check:
  - changed_at_least: 6
    hint: There is not much new code in your project yet. Write the function, call it, and press Run.
  - contains:
      file: design.md
      text: 'Built:'
    hint: Add a line starting `Built:` to `design.md` naming the function you wrote.
  - parses: true
    hint: Something in your project no longer parses. Read the error in the console — it names the file and the line.
example: 'Built: fadePlatform(), called from update() — platforms go transparent then stop being solid.'
```

If that took two attempts and a confusing error message, you did it correctly. Nobody's first
version of a mechanic works, and the reason the last module ended on reading errors is that this is
the lesson where you were going to need it.

Next module is about what happens when there are ten of these instead of one — where the code goes,
and why adding the eleventh thing starts breaking the third.

## Recap

- **Numbers first.** `config.js` is the cheapest way to make the game feel like yours, so tune
  before you build.
- One thing off the page, as **its own named function**, called from `create` or `update` depending
  on whether it happens once or every frame.
- It will be wrong first. That is what the console and the last lesson were for.
- Your one-sheet now records what you built, not just what you meant to build.
