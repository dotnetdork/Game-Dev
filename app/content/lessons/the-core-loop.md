---
title: The Core Loop
xp: 200
ai: full
summary: The thing you do over and over — and why every good game has one.
---

Think about the last game you properly lost track of time in. Now try to describe what you were
*doing* in about five words.

Not the story. Not the graphics. The **doing**.

- Minecraft: mine a block, make a thing, build.
- Mario: run, jump, land, keep going right.
- Fortnite: land, loot, fight, survive.

Five words each. That short list is the **core loop** — the handful of actions you repeat the
entire time you play. Everything else in a game is decoration hung on top of it.

```run
// @goal: A three-second loop, over one sitting. Change how long somebody plays.
// @slider: minutes 1 60 1 20
const secondsPerGo = 3;
const goes = Math.round(minutes * 60 / secondsPerGo);
console.log("playing for " + minutes + " minutes");
console.log("you do the loop " + goes + " times");
console.log("so it has to still be worth doing on go number " + goes + ".");
```

<figure class="shot aside pixel">
  <img src="/content/images/shots/pacman-gameplay.png" alt="A Pac-Man maze with pellets, four ghosts and Pac-Man near the bottom">
  <figcaption>The shortest core loop ever shipped: <b>eat a dot, avoid a ghost, repeat</b>. No story,
  no upgrades, no menu. Forty-five years later people still play it, which is the strongest argument
  in this whole lesson.
  <cite><b>Pac-Man</b> (1980) — Bandai Namco Entertainment America, CC BY 3.0.</cite></figcaption>
</figure>

## Why the loop is short on purpose

<div class="tip aside"><b>Also called</b> the "gameplay loop" or the "compulsion loop". Designers
argue about which name is right; they all mean the handful of things you do over and over.</div>

A good core loop is small enough to learn in about ten seconds and interesting enough to do a
thousand times.

That sounds like a contradiction. It isn't. What makes a loop worth repeating is not that it's
complicated, but that **it comes out slightly differently every time**. Mario's jump is one button.
But the gap you're jumping is never quite the same gap, so the same single button stays interesting
for hours.

```run
// @goal: One button, eight goes. Take the variation to zero and see what happens.
// @slider: variation 0 40 5 20
let previous = null;
for (let go = 1; go <= 8; go++) {
  const gap = 100 + Math.round((Math.random() - 0.5) * 2 * variation);
  console.log("go " + go + ": jump a gap of " + gap + " pixels"
    + (gap === previous ? "   (exactly the same as last time)" : ""));
  previous = gap;
}
console.log(variation === 0
  ? "Every go identical. Your brain stops paying attention somewhere around go three."
  : "The same single button, never quite the same jump. That is what keeps it alive.");
```

> If you can explain your loop in one sentence and it still sounds fun, you have something. If it
> takes a paragraph, you probably have three loops fighting each other.

## The loop has three parts

Every core loop, in every game ever made, is the same three beats:

1. **You do something** — press a button, aim, choose.
2. **The game answers** — you land, you miss, the block breaks.
3. **You're set up to do it again** — usually somewhere slightly different.

Miss any one of those three and the loop dies. No answer and it feels broken. No setup for the next
go and it feels like an ending.

```quiz
question: In Minecraft, "mine a block → get the block → use it to build something you need more blocks for" is an example of what?
options:
  - The core loop
  - The graphics engine
  - The physics system
  - The user interface
answer: 0
feedback:
  - Exactly — a short set of actions that feeds back into itself.
  - Graphics are how it looks, not what you repeatedly do.
  - Physics is how things move and collide. The loop is what the *player* does.
  - The interface is the buttons and menus around the game.
explain: A core loop is the short set of actions a player repeats, where finishing one go sets up the next.
```

<figure class="diagram">
  <img src="/content/images/core-loop.svg" alt="Left: goal, action and reward joined in a circle that keeps turning. Right: the same circle with the reward replaced by nothing, so it stops after one turn.">
  <figcaption>Take away any one of the three and the circle stops being a circle. The reward is the part people forget, and it is the part that makes a player want a <b>second</b> go.</figcaption>
</figure>

## Loops inside loops

Bigger games stack loops. RuneScape is a good example because the stacking is so obvious:

| Loop | How long one go takes |
|---|---|
| Swing at a tree, get a log | About 3 seconds |
| Fill your bag, run to the bank | About 2 minutes |
| Get the level you wanted | Several hours |

The short loop keeps your hands busy. The medium loop gives you something to aim at this
afternoon. The long loop is the reason you come back tomorrow.

```run
// @goal: Stack the three loops. Change how long somebody plays and count what they finish.
// @slider: minutes 1 180 5 45
const loops = [["swing at a tree, get a log", 3], ["fill the bag, run to the bank", 120], ["get the level you wanted", 7200]];
const seconds = minutes * 60;
loops.forEach(function (l) {
  const times = Math.floor(seconds / l[1]);
  console.log(l[0] + ": " + times + (times === 1 ? " time" : " times"));
});
console.log("the short one keeps your hands busy; the long one is why you come back tomorrow.");
```

You do **not** need all three. Your first game only needs the short one — and that is the one this
lesson is about. Get the three-second loop right and everything else has something to hang on.

## When a loop is broken

A loop can be technically fine and still feel dead. The usual causes:

- **The answer is missing.** You do the thing and nothing seems to change.
- **The answer is too slow.** You do the thing and find out four seconds later.
- **Every go is identical.** Nothing varies, so your brain stops paying attention.

Here's a loop with one of those problems. The player collects coins — but something about doing it
over and over isn't working.

```challenge
title: Lab — the loop that goes nowhere
task: Collecting a coin should set up the next collection. Right now it doesn't. Make a new coin appear in a new spot each time one is collected.
hint: Look at what happens inside `collect()`. The coin disappears — but nothing ever puts a new one anywhere.
solution: |
  let px = 150, py = 100, cx = 60, cy = 60, score = 0;
  const spots = [];                  // where each coin was, so we can prove the loop repeats
  function collect() {
    score = score + 1;
    spots.push(cx + "," + cy);
    cx = 20 + Math.random() * 260;   // a NEW coin, somewhere new
    cy = 20 + Math.random() * 160;
    if (new Set(spots).size >= 3) win();   // three DIFFERENT coins, not one counted three times
  }
  function draw() {
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#f5b02e"; ctx.fillRect(cx, cy, 12, 12);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(px, py, 18, 18);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "14px sans-serif";
    ctx.fillText("Score: " + score, 10, 20);
  }
  function step() {
    px = px + (cx > px ? 2 : -2);
    py = py + (cy > py ? 2 : -2);
    if (Math.abs(px - cx) < 14 && Math.abs(py - cy) < 14) collect();
    draw();
    if (score < 3) requestAnimationFrame(step);
  }
  step();
code: |
  let px = 150, py = 100, cx = 60, cy = 60, score = 0;
  const spots = [];                  // the goal: collect coins in three DIFFERENT places
  function collect() {
    score = score + 1;
    spots.push(cx + "," + cy);
    // the coin vanishes... and that is the end of it. no new coin, nowhere new to go.
    if (new Set(spots).size >= 3) win();
  }
  function draw() {
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#f5b02e"; ctx.fillRect(cx, cy, 12, 12);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(px, py, 18, 18);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "14px sans-serif";
    ctx.fillText("Score: " + score, 10, 20);
  }
  function step() {
    px = px + (cx > px ? 2 : -2);
    py = py + (cy > py ? 2 : -2);
    if (Math.abs(px - cx) < 14 && Math.abs(py - cy) < 14) collect();
    draw();
    if (score < 3) requestAnimationFrame(step);
  }
  step();
```

That third beat — *set up the next go* — is the one people forget. It's the difference between a
game and a thing that happens once.

```quiz
question: A game where you shoot one target, it explodes, and then nothing else ever appears is missing which part of the loop?
options:
  - Setting up the next go
  - The player doing something
  - The game answering
  - All three
answer: 0
feedback:
  - Right. You act, it answers — and then the loop has nowhere to go.
  - The player does act — they shoot.
  - The game does answer — the target explodes.
  - Two of the three are fine here. Only the last beat is missing.
explain: Doing and answering both happen; what's missing is anything to do next.
```

```yourturn
title: Name your loop, then make it repeat
task: Your own game needs a loop before it needs anything else. Write it down first — if you can't say it in one sentence, it isn't ready.
steps:
  - Open the Code tab and look at your game.
  - In config.js, add a comment at the top with your loop in one sentence, like "// Loop — dodge falling rocks, grab the coins they knock loose, go again."
  - Find the thing your player collects or hits, and make sure something NEW appears afterwards. If nothing does, the loop stops on the first go.
  - Press Run and do your loop five times without stopping. If you got bored on go number three, the loop is too samey — change one thing so each go is a little different.
reward: Loop Builder badge
```

## The one-sentence test

Before your game has art, sound, menus or a title, it should pass this:

> *"You ________, which lets you ________, so you can ________ again."*

Minecraft: you **mine**, which lets you **build**, so you can **reach new places to mine** again.

```run
// @goal: Put YOUR game in the three blanks, then press Run. No slider — edit the words.
const you = "mine";
const whichLetsYou = "build";
const soYouCan = "reach new places to mine";
console.log("You " + you + ", which lets you " + whichLetsYou + ", so you can " + soYouCan + " again.");
console.log(soYouCan.indexOf(you) >= 0
  ? "The last blank leads back to the first. That is a loop."
  : "Does the last blank lead back to the first? If it does not, this is a line, not a loop.");
```

If your sentence has a hole in it, that hole is what you build next.

## Recap

- The **core loop** is the short set of actions a player repeats.
- It has three beats: **you act**, **the game answers**, **you're set up to go again**.
- Short and varied beats long and complicated.
- Big games stack loops, but every one of them starts with a good three-second loop.
