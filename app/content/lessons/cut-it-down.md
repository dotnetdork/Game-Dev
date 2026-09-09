---
title: Cut It Down
xp: 240
ai: full
checkpoint: true
summary: Rewrite your one-sheet now that you know what a loop, a reward and a difficulty curve are.
---

Five lessons ago you had a page describing your game in ordinary words. Now you have words for the
things on it: the core loop, feedback, difficulty, risk and reward, progression.

So the page is out of date — not wrong, just written by somebody who knew less than you do. Time to
rewrite it in the language you now have.

```yourturn
title: Write your core loop down in one sentence
task: 'Your game has a core loop whether you designed one or not. Name it: the thing the player does, what the game does back, and what sets up the next go.'
steps:
  - Open the Code tab and open `design.md`.
  - Add a new heading `## My core loop` under your verb.
  - 'Write it in three parts, in one sentence: you do X, the game answers with Y, and then Z sets up the next go.'
  - Read it back and check the loop actually closes. If nothing sets up the next go, your game stops after one turn — fix that now, on paper, where it is free.
  - Press Save.
reward: Loop Namer badge
check:
  - contains:
      file: design.md
      text: 'My core loop'
    hint: Add a `## My core loop` heading to `design.md` and write your three-part loop under it.
  - changed_at_least: 3
    hint: '`design.md` has not changed yet. Add the `## My core loop` heading and your sentence.'
example: 'You jump onto a platform, it flashes and starts vanishing, and the next platform is just far enough away to make you commit.'
```

Now the uncomfortable half. You have learned what makes a moment feel good, and you have almost
certainly written down more game than you can build.

```yourturn
title: Cut it to the rule of one
task: Go through your page and cut it until it is one verb, one obstacle, one reason to keep going, and one way to lose. Everything you remove goes on the list rather than in the bin.
steps:
  - Read your one-sheet as though somebody else wrote it and you have ten weeks to build it.
  - Count the verbs. If there is more than one, pick the one your game would die without.
  - Count the kinds of thing that get in the way. Cut it to one kind.
  - Move everything you cut into "What I am NOT building". Do not delete it — you want to be able to look at that list and see that the ideas are safe.
  - Add a line at the bottom starting `Cut on` with today's date and what went.
  - Press Save.
reward: Scope Cutter badge
check:
  - contains:
      file: design.md
      text: 'Cut on'
    hint: Add a line starting `Cut on` at the bottom of `design.md` saying what you removed and when.
  - contains:
      file: design.md
      text: 'NOT building'
    hint: Keep the "What I am NOT building" heading — the things you cut go under it, not in the bin.
example: 'Cut on 12 March: the boss, the shop, and the second enemy type. One enemy, one verb.'
```

What you have now is a page that describes something buildable, in words that mean the same thing
to you as they do to a professional.

Next module is where you start writing the code. The checkpoint at the end of it asks you to build
**one line off this page** and make it run — so the smaller and clearer that page is right now, the
better the next three weeks go.

## Recap

- Your one-sheet is rewritten in the vocabulary you now have — loop, feedback, difficulty, reward.
- A **core loop that does not close** is a game that stops after one turn. Cheapest possible time
  to notice is on paper.
- Cut to the **rule of one**: one verb, one obstacle, one reason to continue, one way to lose.
- Cut things go on the **not-building list**, not in the bin. That is what lets you stop thinking
  about them.
- Next module you build one line of this page for real.
