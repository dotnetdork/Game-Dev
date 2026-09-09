---
title: Your Game in One Line
xp: 240
ai: full
checkpoint: true
summary: The first thing that is yours rather than ours.
---

You have spent four lessons on somebody else's game. You know what an engine does for you, why
things fall, what the pictures and sounds are, and how a game gets onto another person's machine.

This lesson is different. Nothing here is about our game. **Every step is about yours**, and the
module's stars are waiting on it.

```yourturn
title: Say what your game is, in one sentence
task: 'One sentence in your own project. Not a paragraph, not a story — a sentence somebody could repeat back to you. It does not have to be good, and you will change it four more times before the course ends.'
steps:
  - Open the Code tab. At the top of the file list there is a file called `design.md` — click it.
  - Read the top. It is a page with headings and grey lines in brackets telling you what goes where.
  - Under "My game is...", replace the grey line with your sentence.
  - If you are stuck, start with `A platformer where` and finish it. The starter game is a platformer, so anything you write is something you could actually build.
  - Press Save.
reward: One-Liner badge
check:
  - contains:
      file: design.md
      text: 'My game is'
    hint: Keep the "My game is..." heading in `design.md` — write your sentence underneath it rather than over it.
  - changed_at_least: 2
    hint: '`design.md` has not changed yet. Write your sentence under "My game is..." and press Save.'
example: A platformer where the platforms disappear one second after you land on them.
```

Two things about what you just did, because they are easy to miss.

**That file is yours.** Nothing in the course will overwrite it, and pressing Reset on the game
leaves it alone. It is the only file in your project that is not code, and it is the only one that
is about a game that does not exist yet.

**It is meant to be wrong.** Your first sentence is a guess made by somebody who has not built the
thing. You will open this page again at the end of every module from here on, and every time you
will know something you do not know today.

```yourturn
title: Find out whether it survives being read out
task: A sentence that only makes sense inside your own head is not finished. This is the cheapest test there is, and professionals run it constantly.
steps:
  - Read your sentence out loud to somebody near you — the person next to you, or your teacher.
  - Do not explain it afterwards. Watch whether they got it from the sentence alone.
  - If they asked a question, your sentence was missing that answer. Put it in.
  - 'Open `design.md` again and add a line under your sentence starting `Somebody asked:` with whatever they wanted to know. If nobody asked anything, write `Somebody asked: nothing.`'
  - Press Save.
reward: Playtest Ear badge
check:
  - contains:
      file: design.md
      text: 'Somebody asked:'
    hint: Add a line starting `Somebody asked:` under your sentence in `design.md`, saying what they wanted to know.
example: 'Somebody asked: do the platforms come back?'
```

Next module is about where ideas actually come from, and what to do when the one you just wrote
down turns out to be too big. Which it probably is — everybody's first one is.

## Recap

- You have a sentence, and it is the first thing in this course that is yours.
- It lives in **`design.md`** in your own project, next to the code. Reset does not touch it.
- It is **supposed to be wrong**. You will revise it at the end of every module.
- Reading it out loud to somebody is the cheapest test in game development. The questions they ask
  are the holes in your idea.
