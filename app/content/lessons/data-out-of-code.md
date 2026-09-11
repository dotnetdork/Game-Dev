---
title: Data Out of Code
xp: 220
ai: full
summary: Why the enemy's speed belongs in a list, not buried in a line.
---

You want to make the enemies slightly faster.

How many places do you have to change? If the answer is more than one, this lesson is for you — and
if the answer is "I'm not sure", it's *definitely* for you.

## Numbers hiding in the logic

Here's what code looks like before anyone thinks about this:

```
enemy.setVelocityX(120);
if (player.y > 580) loseLife();
spawnTimer = 750;
if (score > 1000) nextLevel();
```

Every one of those numbers is a **design decision** — how hard the game is, how fast it feels, how
long it lasts — buried in the middle of the machinery that makes it work.

```run
// @goal: Change how the game plays. Count the places you have to visit each way.
// @slider: thingsToChange 1 6 1 4
// @demo: compare
// @feed: linesToHunt, filesToOpen
const linesToHunt = thingsToChange;    // magic numbers: one scattered line for each change
const filesToOpen = 1;                 // one CONFIG: all of them in one place
```

Those are called **magic numbers**, and the problem isn't that they're wrong. It's that they're
*hidden*. To make the game slightly easier you have to go hunting through files, and you will miss
one.

<figure class="diagram">
  <img src="/content/images/file-map.svg" alt="A map of the starter game's files: main.js starts the engine and calls game.js, which calls world.js, player.js and coins.js. All three read config.js.">
  <figcaption>Your own game is already built this way. Solid arrows are one file <b>calling</b> another; the dashed ones are every file <b>reading</b> the same numbers out of <code>config.js</code> — which is why changing one number there changes the game everywhere at once.</figcaption>
</figure>

## A list you can read at a glance

Move them out:

```
const CONFIG = {
  enemySpeed:   120,
  spawnDelay:   750,
  levelUpScore: 1000,
  fallLimit:    580
};
```

Then the code reads `enemy.setVelocityX(CONFIG.enemySpeed)`.

```run
// @goal: Read the game out of its own numbers. Change one and see what it says about play.
// @slider: enemySpeed 60 220 10 120
const CONFIG = { enemySpeed: enemySpeed, spawnDelay: 750, levelUpScore: 1000, fallLimit: 580 };
console.log("enemySpeed:   " + CONFIG.enemySpeed);
console.log("spawnDelay:   " + CONFIG.spawnDelay + "ms between enemies");
console.log("levelUpScore: " + CONFIG.levelUpScore);
console.log(CONFIG.enemySpeed > 160 ? "reads as: fast and frantic"
  : CONFIG.enemySpeed < 90 ? "reads as: slow and forgiving"
  : "reads as: brisk, but fair");
```

Two things just happened, and the second is the bigger one:

1. All the tuning is in one place you can find.
2. **The list is now a description of your game.** You can read those four lines and know roughly
   how it plays, without reading a single line of logic.

That's why your starter project already has `config.js` at the top of the file list. It's the file
you're meant to fiddle with.

```quiz
question: What is actually wrong with writing `enemy.setVelocityX(120)` directly?
options:
  - The number is a design decision hidden inside the machinery
  - 120 is too fast
  - Phaser cannot read numbers written that way
  - It makes the game slower
answer: 0
feedback:
  - Right. It is not wrong, it is hidden — and hidden means you will miss one when you change it.
  - Might be perfect. The problem is where it lives, not its value.
  - Phaser is quite happy with it.
  - No performance difference at all.
explain: A magic number is a design decision buried in logic. Moving it out does not change behaviour; it makes the decision findable.
```

## Adding a level without writing code

Once numbers are data, something interesting becomes possible. A level stops being code:

```
const LEVELS = [
  { enemies: 3,  speed: 100, time: 60 },
  { enemies: 5,  speed: 130, time: 60 },
  { enemies: 8,  speed: 160, time: 45 }
];
```

Adding a fourth level is now adding a line to a list. No new logic, nothing to break, nothing to
test — because the code that reads the list hasn't changed.

This is also how you get a *designer* who isn't a programmer contributing to your game. They can
balance the whole thing without touching anything that can break.

## How real games do it

<figure class="shot">
  <img src="/content/images/shots/minecraft-crafting.jpg" alt="The Minecraft crafting table interface, with items arranged in a three-by-three grid producing a wooden sword">
  <figcaption>Every recipe in Minecraft is a row in a data file — a shape of ingredients and what it
  makes. Nobody wrote <code>if (twoPlanksAndAStick) makeSword()</code>. That is why the game can add
  a hundred recipes in an update without touching the crafting code, and why the modding community
  can add ten thousand more without being allowed near it.
  <cite><b>Minecraft</b> — Xbox México, CC BY 3.0.</cite></figcaption>
</figure>

<figure class="shot">
  <img src="/content/images/shots/supertux-editor.jpg" alt="The SuperTux level editor: a level being built by placing tiles from a palette on the right onto a grid">
  <figcaption>The same idea, one level up. This is a level being <em>drawn</em>, not programmed —
  what comes out is a file listing which tile goes where. The game reads it. Get this right and
  designing a new level stops needing a programmer, which is the moment your friends can build
  things for your game.
  <cite><b>SuperTux</b> level editor — SuperTux Development Team, level by Daniel Alston, screenshot
  by PantheraLeo1359531, CC BY-SA 3.0.</cite></figcaption>
</figure>

Every game you've played does this, usually much further than a single file.

Minecraft's blocks, recipes and mobs are data files. Modders change them without a compiler, which
is most of why Minecraft has the modding scene it does. Big studios keep balance numbers in
spreadsheets that get exported into the game, so designers can tune a weapon without asking a
programmer.

The general principle is worth remembering well beyond games:

> Anything you expect to **change often** should be data. Anything that describes **how the machine
> works** should be code.

Speed, health, spawn rates, level layouts, prices: data. What "collide" means: code.

```challenge
title: Lab — the numbers you cannot find
task: The settings for this game are scattered through the code. Gather every one of them into a single settings object at the top.
hint: There is an empty `CONFIG` at the top. Move each loose number into it and make the code read from there — the behaviour must not change.
solution: |
  // The goal: no loose tuning numbers left in the logic. Behaviour identical.
  const CONFIG = { enemySpeed: 3, spawnEvery: 5, levelUpAt: 4 };
  let x = 0, spawned = 0, level = 1, ticks = 0;
  const loose = 0;                    // how many tuning numbers are still buried below
  function tick() {
    ticks = ticks + 1;
    x = x + CONFIG.enemySpeed;
    if (ticks % CONFIG.spawnEvery === 0) spawned = spawned + 1;
    if (spawned >= CONFIG.levelUpAt) level = 2;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
    ctx.fillText("x " + x + "   spawned " + spawned + "   level " + level, 10, 30);
    ctx.fillText("settings still buried in the logic: " + loose, 10, 55);
    if (ticks >= 25) {
      if (loose === 0) { ctx.fillStyle = "#3ddc84"; ctx.fillText("All tuning in one place.", 10, 95); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText(loose + " numbers still hidden.", 10, 95); }
      return;
    }
    requestAnimationFrame(tick);
  }
  tick();
code: |
  // The goal: no loose tuning numbers left in the logic. Behaviour identical.
  const CONFIG = { };                 // empty, for now
  let x = 0, spawned = 0, level = 1, ticks = 0;
  const loose = 3;                    // how many tuning numbers are still buried below
  function tick() {
    ticks = ticks + 1;
    x = x + 3;                        // enemy speed, hiding
    if (ticks % 5 === 0) spawned = spawned + 1;   // spawn rate, hiding
    if (spawned >= 4) level = 2;                  // level-up point, hiding
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
    ctx.fillText("x " + x + "   spawned " + spawned + "   level " + level, 10, 30);
    ctx.fillText("settings still buried in the logic: " + loose, 10, 55);
    if (ticks >= 25) {
      if (loose === 0) { ctx.fillStyle = "#3ddc84"; ctx.fillText("All tuning in one place.", 10, 95); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText(loose + " numbers still hidden.", 10, 95); }
      return;
    }
    requestAnimationFrame(tick);
  }
  tick();
```

Notice the game behaves identically before and after. That's the point — this kind of change makes
the code easier to live with without changing what the player sees at all.

```quiz
question: Which of these belongs in a settings file rather than in the code?
options:
  - How much health an enemy starts with
  - What "collide" means
  - How the game loop works
  - How sprites get drawn
answer: 0
feedback:
  - Right. It is a design decision you will change many times while balancing.
  - That is machinery — how the game works, not how it is tuned.
  - Definitely machinery.
  - Also machinery.
explain: Things you expect to change often are data. Things that describe how the machine works are code.
```

Your own game has the same scattering. Numbers you picked weeks ago are sitting in the middle of lines that do other things, and every one of them is a number you cannot find when you want to change it.

```yourturn
title: Collect your own settings
task: Move every tuning number in your game into `config.js` where you can find them.
steps:
  - Open the Code tab and read through `game.js`, `player.js` and `world.js` looking for bare numbers.
  - For each one, ask whether it is a decision you might change while balancing. If yes, it is a setting.
  - Move it into CONFIG in `config.js` with a name that says what it is, and make the code read from there.
  - Press Run and check the game plays exactly as before — this change should be invisible to a player.
  - Now change two of them and play again. That is how quick balancing should feel.
reward: Data Driver badge
```

## Recap

- A **magic number** is a design decision hidden inside the machinery.
- Moving tuning into one settings object makes it **findable**, and makes the list a description of
  your game.
- Once levels are **data**, adding one is adding a line — no new logic, nothing to break.
- Real games go much further; it is why Minecraft modding exists.
- **Changes often → data. Describes how the machine works → code.**

goal: Every setting sits in one object at the top, and nothing is left buried in the code below.