---
title: Reading an Error
xp: 240
ai: full
summary: How to find a bug on purpose instead of by guessing.
---

Everybody's code breaks. Every single day, for everyone who does this professionally.

The difference between someone who has been coding for a week and someone who has been doing it for
a year isn't that one of them writes working code. It's entirely about **what they do next.**

## The message is not shouting at you

An error message looks aggressive. Red text, capital letters, a wall of file names. Most beginners'
first instinct is to close it.

It's actually the most helpful thing on the screen. It's the computer saying, precisely: *here is
the exact line where I got stuck, and here is what I was expecting instead.*

Read it. It's shorter than it looks, and only two parts matter.

```run
// @goal: Cause a real error on purpose, then read it. Slide to 1 to make the player exist.
// @slider: makeThePlayer 0 1 1 0
let player;
if (makeThePlayer === 1) player = { x: 120 };
try {
  console.log("the player is at x = " + player.x);
} catch (e) {
  console.log(e.name + ": " + e.message);
  console.log("WHAT: something is undefined, and the code asked it for .x");
  console.log("WHERE: the line just above — which is where to look first.");
}
```

## Where it happened, and what it expected

<figure class="diagram">
  <img src="/content/images/error-anatomy.svg" alt="An error message broken into four labelled parts: the kind of problem, what it wanted, which file, and which line. Read it backwards, starting from the file and line.">
  <figcaption>The same four parts are in every error message you will ever see, in every language.
  Learn to find them once and errors stop being shouting and start being a map.</figcaption>
</figure>

Take this:

```
TypeError: Cannot read properties of undefined (reading 'x')
    at update (game.js:42)
```

Two pieces of information:

- **Where:** `game.js`, line 42. Go there first, always.
- **What:** something is `undefined`, and the code tried to read `.x` from it.

Translated into English: *on line 42 you asked for the `x` of something that doesn't exist.*

Now you can look at line 42 and ask which thing was supposed to exist and doesn't. Usually the
answer is a sprite you thought you created, or a name spelled slightly differently.

```quiz
question: '`ReferenceError: playerSpeed is not defined  at update (game.js:17)` — what does this tell you?'
options:
  - Line 17 uses a name that was never created, or is spelled differently
  - Line 17 is too slow
  - The player is moving at the wrong speed
  - Phaser is broken
answer: 0
feedback:
  - Right. "Not defined" means the name has never been made, so a typo or a missing `let` is the usual cause.
  - Errors are about correctness, not speed.
  - Nothing is moving at all — the line never ran.
  - It is almost never Phaser. It is almost always a name.
explain: '"X is not defined" means nothing was ever created under that name. Check spelling, and check it was created somewhere the code can see.'
```

## Guess, check, repeat

Here's the thing that separates debugging from flailing. When novices are given broken code, most
of them start changing things at random and running it again to see what happens.

That almost never works, and worse, it teaches you nothing when it does.

The method is boring and it always works:

1. **Read the error.** Where, and what.
2. **Make a guess.** "I think `player` is undefined because it's created in the wrong function."
3. **Check the guess** — one change, or one `console.log`, that would prove it true or false.
4. **Repeat.** A wrong guess is progress: you've eliminated something.

```run
// @goal: Two suspects, one check each. Change which one you look at.
// @slider: suspect 1 2 1 1
const player = { x: 40 };
let enemy;                                   // never created
const looking = suspect === 1 ? player : enemy;
console.log("guess: suspect " + suspect + " is the undefined one");
console.log("check: it is " + (looking === undefined ? "undefined   <- found it" : JSON.stringify(looking)));
console.log(looking === undefined
  ? "One log, one answer."
  : "Guess was wrong — and you have still eliminated one of the two. That is progress.");
```

The single most useful tool here is `console.log`. Put it just before the broken line and print the
thing you suspect:

```
console.log("player is:", player);
```

If it prints `undefined`, you've found it in one step.

## The four bugs you will meet most

| Message | Usually means |
|---|---|
| `X is not defined` | A typo, or you used it before creating it |
| `Cannot read properties of undefined` | The thing you're reading from doesn't exist |
| `X is not a function` | A typo in the method name, or it's not the type you think |
| *No error, nothing happens* | Your code never ran — check the condition around it |

That last row is the sneakiest. **No error is not the same as no bug.** If something silently does
nothing, the usual cause is an `if` that's never true, so the code inside never runs at all.

```challenge
title: Lab — three errors, one at a time
task: This code has three separate problems. Fix them one at a time, reading what the log says before you change anything.
hint: Work top to bottom. First a name that was never made, then reading from something that does not exist, then a condition that can never be true.
solution: |
  // The goal: fix all three so `cleared` reaches 3.
  let cleared = 0;
  const player = { x: 10, y: 20 };
  const speed = 5;                        // 1. it exists now
  let log = [];
  // 1. using a name that was never created
  try { const a = speed + 1; cleared = cleared + 1; log.push("1 ok"); }
  catch (e) { log.push("1: " + e.message); }
  // 2. reading a property from something that does not exist
  try { const b = player.x; cleared = cleared + 1; log.push("2 ok"); }
  catch (e) { log.push("2: " + e.message); }
  // 3. a condition that can never be true, so the code inside never runs
  if (player.x > 5) { cleared = cleared + 1; log.push("3 ok"); }
  else log.push("3: the if never ran");
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
  log.forEach(function (line, i) { ctx.fillText(line, 10, 30 + i * 20); });
  ctx.fillText("cleared " + cleared + " of 3", 10, 120);
  if (cleared === 3) { ctx.fillStyle = "#3ddc84"; ctx.fillText("All three found.", 10, 150); win(); }
code: |
  // The goal: fix all three so `cleared` reaches 3.
  let cleared = 0;
  const player = { x: 10, y: 20 };
  let log = [];
  // 1. using a name that was never created
  try { const a = speed + 1; cleared = cleared + 1; log.push("1 ok"); }
  catch (e) { log.push("1: " + e.message); }
  // 2. reading a property from something that does not exist
  try { const b = enemy.x; cleared = cleared + 1; log.push("2 ok"); }
  catch (e) { log.push("2: " + e.message); }
  // 3. a condition that can never be true, so the code inside never runs
  if (player.x > 9999) { cleared = cleared + 1; log.push("3 ok"); }
  else log.push("3: the if never ran");
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
  log.forEach(function (line, i) { ctx.fillText(line, 10, 30 + i * 20); });
  ctx.fillText("cleared " + cleared + " of 3", 10, 120);
  if (cleared === 3) { ctx.fillStyle = "#3ddc84"; ctx.fillText("All three found.", 10, 150); win(); }
```

Notice the third one produced **no error at all**. It just quietly did nothing. That's the kind you
have to go looking for.

```quiz
question: Your code produces no error, but one part of your game does nothing at all. Where do you look first?
options:
  - The condition around it — an `if` that is never true means the code never runs
  - The graphics settings
  - The asset files
  - Nowhere; no error means no bug
answer: 0
feedback:
  - Right. Silent nothing usually means the code was never reached.
  - Graphics would look wrong rather than do nothing.
  - A missing asset normally does produce a warning.
  - No error just means nothing crashed. It says nothing about whether it worked.
explain: Code inside a condition that is never true produces no error, because it never runs. Silence is a symptom.
```

```yourturn
title: Break your own game on purpose
task: Make a deliberate mistake, read the error, then fix it. Doing this once when nothing is at stake is worth an hour of panic later.
steps:
  - Open the Code tab and open game.js.
  - Deliberately misspell something — change `player` to `plyer` in one place.
  - Press Run, open the Play tab, and read the message in the console underneath. Find the file and line number in it.
  - Before fixing it, say out loud what the message means in your own words.
  - Fix it, run again, and confirm it goes away. Now you have done the whole loop once, on purpose.
reward: Bug Hunter badge
check:
  # The task is "break it, then fix it", so the end state has to be code that parses. A student who
  # broke it and stopped has not finished; one who never touched it has changed nothing.
  - changed_at_least: 2
    hint: Nothing in your game has changed yet — go and misspell something on purpose first.
  - parses: true
    hint: Your game still has the mistake in it. Read the error, find the file and line, and fix it.
example: player  // the spelling that was there before you broke it
```

## Recap

- Everyone's code breaks. **What you do next** is the skill.
- An error tells you two things: **where** (file and line) and **what** it expected.
- **Guess, check, repeat.** Changing things at random is not debugging.
- `console.log` just before the broken line is the fastest tool you have.
- **No error is not the same as no bug** — silent nothing usually means an `if` that never ran.
