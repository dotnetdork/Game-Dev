---
title: Your One-Sheet
xp: 240
ai: full
checkpoint: true
summary: Fill in the page, and find out whether somebody else could build your game.
---

You have a sentence, a verb, one twist, and a list of things you are not building. This is where
those become a page — the one you will open at the end of every module from now on.

```yourturn
title: Fill in every empty slot
task: Finish the page. Every heading in the file gets a real answer, and "how you lose" is the one people skip.
steps:
  - Open the Code tab and open `design.md`.
  - Work down the headings. Anything still showing a grey line in brackets needs your answer instead.
  - '"How you win" and "How you lose" are the two that matter most. If you cannot lose, you cannot win — so if you have not got a way to lose, invent one now.'
  - Delete the `TODO:` line you added last lesson, and delete the paragraph at the top that says nothing is here yet.
  - Press Save.
reward: Designer badge
check:
  - contains:
      file: design.md
      text: 'How you lose'
    hint: Keep the "How you lose" heading in `design.md` and write your answer under it.
  - changed_at_least: 6
    hint: There are still empty slots in `design.md`. Every heading needs a real answer under it.
example: 'How you lose: you fall off the bottom of the screen, and the coins you were carrying scatter.'
```

Now the test that tells you whether the page is actually finished.

**Could somebody else build the right game from it?** Not build it well — build the *right* one. If
a reader would have to guess, you have not written a design, you have written a mood.

```yourturn
title: Hand it to somebody and shut up
task: 'The hardest part of this is the shutting up. You are not allowed to explain, defend, or add anything out loud — the page has to do the work on its own.'
steps:
  - Give your screen to the person next to you with `design.md` open, and say nothing at all.
  - Ask them one question when they finish reading — "what would you build first?"
  - Listen for whether they describe your game or a different one.
  - Open `design.md` and add a line at the bottom starting `They would build:` with what they said.
  - Fix whichever slot sent them wrong. That slot is the one that was not clear.
  - Press Save.
reward: Second Pair of Eyes badge
check:
  - contains:
      file: design.md
      text: 'They would build:'
    hint: Add a line starting `They would build:` at the bottom of `design.md` with what your reader said.
example: 'They would build: the disappearing platforms first — but they thought the coins moved, which is not in my game.'
```

Keep this page open in a tab for the rest of the course if you can. Every module from here ends by
coming back to it, and each of those checkpoints takes one line off it and turns it into something
that runs.

The next module is about what makes a game *good* rather than what makes it a game — the loop, the
feedback, the difficulty. All five of those lessons are about a decision you have just written
down, so read them with this page in mind.

## Recap

- Your one-sheet is **finished for now** — every slot has a real answer, including how you lose.
- The test is not "is it good", it is **could somebody else build the right game from this**.
- Reading it to somebody and **not explaining** is the only way to find out. The questions they ask
  are the slots that failed.
- It is a **living page**. Every module from here comes back to it, and every later checkpoint
  builds one line of it.
