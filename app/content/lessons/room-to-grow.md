---
title: Room to Grow
xp: 240
ai: full
checkpoint: true
summary: Tidy your own game so the next thing you add does not break the last one.
---

Four lessons ago your game was small enough that everything fitted anywhere. It is not any more,
and this module gave you the four tools for that: one state instead of a pile of flags, things
sharing a shape, parts announcing instead of reaching, and numbers living in data rather than
buried in lines.

This is where you use them on **your** game — not because it is untidy, but because the next thing
you add is about to be harder than the last one, and that is the signal.

```yourturn
title: Get your numbers out of your code
task: Every number you tuned by hunting through a file is a number that belongs in the settings. Move them, so next time you change the feel of your game you change it in one place.
steps:
  - Open the Code tab and read through the files you have changed since the last checkpoint.
  - Find the numbers you typed straight into a line — a speed, a distance, a delay, a count.
  - Move each one into `CONFIG` in `config.js` with a name that says what it is, and use the name where the number used to be.
  - Press Run. It should behave exactly as it did before — that is what makes this safe.
  - Open the Game tab and check your new numbers appear in the inspector on the right. If they are in CONFIG, they are draggable.
reward: Magic Number Hunter badge
check:
  - matches:
      file: config.js
      regex: 'CONFIG'
    hint: '`CONFIG` should still be in `config.js` — move your numbers into it rather than replacing it.'
  - changed_at_least: 4
    hint: Nothing has moved yet. Find a number you typed into a line and give it a name in CONFIG.
  - parses: true
    hint: Something no longer parses. Most likely a number was replaced by a name that is spelled differently in the two places.
example: 'CONFIG.fadeDelay = 1000, used in fadePlatform() where the 1000 used to be.'
```

If dragging that slider in the Game tab now changes your own mechanic, you have just built the same
thing the course's inspector is built on. That is not a coincidence — it is what "data out of code"
buys you.

```yourturn
title: Make room for the thing you have not built yet
task: Look at your not-building list and pick the one you most want. Do not build it. Change your code so that building it later would be easy, and write down what you did.
steps:
  - Open `design.md` and read "What I am NOT building". Pick the item you most wish you could have.
  - Now look at your code and ask the honest question — if you added that next week, how many files would you have to change?
  - Do one thing to lower that number. Split a function that is doing two jobs. Give two similar things the same shape. Move a rule out of the middle of `update()`.
  - Press Run and check nothing broke. A tidy-up that changes behaviour is not a tidy-up.
  - Add a line to `design.md` starting `Room for:` naming the thing and what you changed to make space for it.
reward: Refactorer badge
check:
  - contains:
      file: design.md
      text: 'Room for:'
    hint: Add a line starting `Room for:` to `design.md` naming what you made space for.
  - parses: true
    hint: Something no longer parses after the tidy-up — read the console, it names the file and line.
example: 'Room for: a second enemy type. Pulled the movement out of createEnemy so both kinds can share it.'
```

Nothing in that step made your game do anything new, which is exactly why it is worth a checkpoint.
The work that makes the *next* three weeks possible never looks like progress on the day.

One module left. It is about how the game looks, sounds and feels — and then shipping it.

## Recap

- The signal to tidy up is not mess, it is **the next thing being harder to add than the last one**.
- Numbers typed into lines belong in **CONFIG**, where one place changes the feel and the inspector
  can drag them.
- A tidy-up that **changes behaviour is not a tidy-up**. Run it before and after.
- Making room for something on your not-building list is real work, even though nothing new
  appears on screen.
