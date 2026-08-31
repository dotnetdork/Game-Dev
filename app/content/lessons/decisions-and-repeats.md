---
title: Decisions and Repeats
xp: 220
ai: full
summary: if, loops and functions — the three shapes almost all code is made of.
---

A game makes thousands of decisions every second. Did the player press jump? Is the coin touching
them? Have they run out of lives?

Every single one is the same shape: **if this, then that.**

## if: doing something only sometimes

```run
// @goal: Change the score and watch which message appears.
// @slider: score 0 20 1 3
if (score >= 10) {
  console.log("You win!");
} else {
  console.log("Keep going — you need " + (10 - score) + " more.");
}
```

The bit in brackets is a question with a yes-or-no answer. If yes, the first block runs. If not,
the `else` block does.

The comparisons you'll use constantly:

| Written | Means |
|---|---|
| `a === b` | a is exactly b |
| `a !== b` | a is not b |
| `a > b` / `a < b` | bigger / smaller |
| `a >= b` / `a <= b` | at least / at most |

**Use `===`, not `==`.** The two-character version does some surprising guessing behind your back.
The three-character version asks the question you actually meant.

```quiz
question: What does `if (lives <= 0)` ask?
options:
  - Is lives zero or less?
  - Is lives exactly zero?
  - Is lives more than zero?
  - Set lives to zero
answer: 0
feedback:
  - Right — "at most zero". It catches 0 and also -1, which is why it is safer than `=== 0`.
  - That would be `lives === 0`, which misses losing two lives at once.
  - That is the opposite question.
  - One `=` assigns a value; comparing needs `===` or `<=`.
explain: '`<=` means "at most". Checking `lives <= 0` rather than `lives === 0` survives losing two lives in the same frame.'
```

## Loops: doing something many times

When you want the same work done repeatedly, you don't write it out.

```run
// @goal: Spawn some enemies. Change how many.
// @slider: enemyCount 1 8 1 4
for (let i = 0; i < enemyCount; i++) {
  console.log("enemy " + (i + 1) + " spawns at x = " + (40 + i * 50));
}
console.log("total enemies: " + enemyCount);
```

The `for` line says three things: start counting at 0, keep going while `i` is below the limit, and
add one each time round.

One trap worth knowing now: a loop whose condition never becomes false runs forever and freezes the
page. If your game ever hangs the instant you press Run, look at your loops first.

## Functions: a move you can name

A **function** is a piece of work with a name, so you can ask for it later.

```run
// @goal: Change the bonus and watch both calls change.
// @slider: bonus 0 50 5 10
function scorePoints(base) {
  return base + bonus;
}
console.log("small pickup: " + scorePoints(5));
console.log("big pickup: " + scorePoints(20));
```

Two reasons this matters, and the second is the real one:

1. You write it once and use it in ten places.
2. **It gives the idea a name.** `scorePoints(5)` says what is happening. The same maths spelled out
   inline says only what is being calculated.

Code full of well-named functions reads like a description of the game. That's the goal.

## Putting the three together

<figure class="diagram">
  <img src="/content/images/if-and-loop.svg" alt="Two shapes side by side. An if is a fork: the code goes one way or the other and then carries on. A for loop is a ring: the code comes back to the same question until the answer changes.">
  <figcaption>An <code>if</code> is a fork — you go one way and carry on. A loop is a ring — you come
  back to the same question. Almost every bug in this lesson is one of those two shapes being the
  wrong one, and a loop whose answer never changes is how you freeze the whole
  game.</figcaption>
</figure>

Almost everything is these three stacked up: a **loop** that goes through the enemies, an **if**
that checks each one, and a **function** saying what to do when it matches.

```challenge
title: Lab — the check that never fires
task: The rule is written but never comes true, so nothing ever happens. Read the condition carefully and work out what it is really asking.
hint: The player's health only ever goes down to 0, one at a time. What exactly is that `if` waiting for?
solution: |
  // The goal: notice when the player runs out of health.
  let health = 3, ticks = 0, noticed = false;
  function checkDead() {
    if (health <= 0) {            // "at most zero" — catches 0, and overshoots too
      noticed = true;
    }
  }
  function step() {
    ticks = ticks + 1;
    if (ticks % 4 === 0 && health > 0) health = health - 1;
    checkDead();
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "14px sans-serif";
    ctx.fillText("health " + health, 10, 30);
    if (noticed) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Game over spotted.", 10, 60); win(); return; }
    if (ticks < 60) requestAnimationFrame(step);
    else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Health hit 0 and nothing noticed.", 10, 60); }
  }
  step();
code: |
  // The goal: notice when the player runs out of health.
  let health = 3, ticks = 0, noticed = false;
  function checkDead() {
    if (health < -5) {            // when could this possibly happen?
      noticed = true;
    }
  }
  function step() {
    ticks = ticks + 1;
    if (ticks % 4 === 0 && health > 0) health = health - 1;
    checkDead();
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "14px sans-serif";
    ctx.fillText("health " + health, 10, 30);
    if (noticed) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Game over spotted.", 10, 60); win(); return; }
    if (ticks < 60) requestAnimationFrame(step);
    else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Health hit 0 and nothing noticed.", 10, 60); }
  }
  step();
```

Conditions are the part beginners misread most often, because a wrong one looks exactly like a right one until you run it.

```quiz
question: What is the main reason to pull repeated code out into a named function?
options:
  - It gives the idea a name, so the code says what it is doing
  - It makes the game run faster
  - Phaser requires it
  - It uses less memory
answer: 0
feedback:
  - Right. Reuse is useful; being readable is the bigger win.
  - Speed is basically unchanged.
  - You can write Phaser without your own functions — it is just much worse to read.
  - Memory is not meaningfully affected.
explain: Reuse saves typing, but naming is what makes code readable. `spawnEnemy()` says what happens; ten lines of maths only says how.
```

You now have the three shapes almost all code is made from. The fastest way to own them is to point at one in code you did not write and say what it does.

```yourturn
title: Name a move in your own game
task: Find something your game does in more than one place, and turn it into a function whose name says what it does.
steps:
  - Open the Code tab and read through `game.js` looking for similar-looking lines in two places.
  - Cut one copy out and wrap it in `function doSomethingUseful() { ... }` near the other functions.
  - Replace both places with a call to your new function.
  - Press Run. Nothing should look different — that is the point. Same game, clearer code.
reward: Logic Wrangler badge
```

## Recap

- **`if`** runs something only when a question is true; `else` covers the rest.
- Compare with **`===`**, not `==`. Prefer `<= 0` over `=== 0` for "ran out".
- **Loops** repeat work. A loop whose condition never ends freezes everything.
- **Functions** let you reuse work — and more importantly, **give it a name**.
- Nearly all game code is these three stacked together.

goal: The condition finally comes true and the thing it guards actually happens.