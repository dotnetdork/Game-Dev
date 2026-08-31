---
title: Difficulty and Flow
xp: 200
ai: full
summary: Why the best games are always just hard enough — and how they teach without a tutorial.
---

Super Mario Bros. has no tutorial. No pop-up telling you which button jumps. And yet almost nobody
has ever been confused by the first few seconds of it.

That isn't luck. Level 1-1 is one of the most carefully built teaching spaces in games, and it
works entirely by making things **just hard enough**.

## The zone

Think about how you feel when a game is too easy: bored. Too hard: frustrated, then you quit.

In between there's a narrow band where you're working, but you believe you can do it. Designers
call it **flow**. It's the state where you look up and an hour has gone.

```run
// @goal: Set the difficulty against a player who is already twenty minutes in. Find the band.
// @slider: difficulty 1 20 1 6
const skill = 8;                          // how good they have got by now
const gap = difficulty - skill;
console.log("player skill: " + skill + "    difficulty: " + difficulty);
console.log(gap < -2 ? "Too easy. Bored, and gone in another five minutes."
  : gap > 2 ? "Too hard. Frustrated, then gone right now."
  : "In the band. This is flow.");
```

The catch is that the band **moves**. What was hard twenty minutes ago is easy now, because you got
better. So a game that stays at one difficulty will eventually bore everybody, no matter where it
started.

> Good difficulty isn't a setting. It's a slope that climbs at roughly the speed the player
> improves.

<figure class="shot aside pixel">
  <img src="/content/images/shots/space-invaders.gif" alt="Space Invaders: rows of aliens descending towards a cannon at the bottom of the screen">
  <figcaption>Space Invaders has one difficulty dial and it turns itself: the fewer aliens are left,
  the faster they move. Nobody designed a level three. The game gets harder <em>because you are
  winning</em>, which is the cheapest good difficulty curve ever built.
  <cite><b>Space Invaders</b> (1978) — Taito. Used for teaching commentary; see
  CREDITS.md.</cite></figcaption>
</figure>

## How Mario teaches you, without words

Watch the first fifteen seconds of 1-1 in your head:

1. You start in an empty space. Nothing can hurt you. You press things and find out one makes you
   move.
2. A single Goomba walks slowly toward you, on flat ground, with plenty of room. You either jump it
   or you get hit — and getting hit costs almost nothing this early.
3. Then a block to jump onto. Then a gap. Then a gap **with** a Goomba.

Each step adds exactly one new thing, in a safe place, before combining it with something you
already know. By the time it's genuinely hard, you learned every piece separately.

Minecraft does the same trick with time: your first day is completely safe. Night is when things
get dangerous — by which point you've had ten minutes to work out mining and crafting.

```quiz
question: Mario's level 1-1 introduces one Goomba, alone, on flat ground, with lots of space. Why not start with three on a narrow ledge?
options:
  - So the player can learn one new thing safely before it gets combined with anything else
  - Because three Goombas would be too slow to draw
  - To save memory on the game cartridge
  - Because Goombas always appear alone
answer: 0
feedback:
  - Exactly. One new idea at a time, somewhere failing is cheap.
  - Drawing speed has nothing to do with it.
  - It's a design decision, not a technical one.
  - They appear in groups later — once you know what they do.
explain: New ideas are introduced alone, in safe places, and only combined once each piece is understood.
```

<figure class="diagram">
  <img src="/content/images/flow-channel.svg" alt="A graph of difficulty against player skill. A diagonal band through the middle is the zone; above it the game is too hard, below it too easy. An orange stepped line climbs through the band.">
  <figcaption>The orange line is a game doing this well: flat stretches where the player practises, then a step up where you ask for something new. Leave the band upward and they quit; drift out of it downward and they get bored.</figcaption>
</figure>

## Three dials you can turn

<figure class="shot">
  <img src="/content/images/shots/supertux-level.jpg" alt="A SuperTux level: Tux running along a grassy platform with floating blocks, coins and a snowball enemy ahead">
  <figcaption>A platformer teaching you without a word of text, exactly the way Mario does it. The
  first enemy is slow and on flat ground with room to retreat. The coins are placed where they lead
  you somewhere. Nothing here can kill you before you understand it — and every one of those is a
  dial someone chose to leave turned down.
  <cite><b>SuperTux</b> — SuperTux developers, screenshot by Liikiill, GPLv3.</cite></figcaption>
</figure>

You don't need clever code to control difficulty. You need numbers you can adjust:

| Dial | Turn it up and... |
|---|---|
| **Speed** | Enemies move faster, things fall quicker, you have less time to think |
| **Amount** | More enemies, more obstacles, more to track at once |
| **Room for error** | Narrower gaps, less health, fewer second chances |

Most games turn all three, slowly, at the same time. The mistake beginners make is turning them in
big jumps — level 1 is trivial, level 2 is impossible.

```run
// @goal: Turn all three dials at once. Walk up the levels and watch nothing double.
// @slider: level 1 10 1 5
const speed = (2 + level * 0.6).toFixed(1);
const enemies = 1 + Math.floor(level / 2);
const lives = Math.max(1, 5 - Math.floor(level / 3));
console.log("level " + level + ":   speed " + speed + "   enemies " + enemies + "   lives " + lives);
console.log("three dials moving a little, together — not one of them jumping.");
```

## Failing should be cheap

Here's the thing that surprises people: **hard games are more fun when losing costs less.**

If dying sends you back thirty seconds, you'll try a tough jump ten times and enjoy it. If dying
sends you back ten minutes, you'll try it twice and quit. The difficulty didn't change — the price
of failure did.

So when your game feels too hard, before you make it easier, ask whether you could just make
**failing quicker to recover from**.

Here's a game whose difficulty goes wrong.

```challenge
title: Lab — the difficulty cliff
task: This game jumps straight from trivial to impossible. Make the speed climb gradually instead, so it gets harder at about the rate a player improves.
hint: Look at how `speed` changes. It doubles all at once at score 3. What if it went up by a small amount every time instead?
solution: |
  // The goal: reach level 6 with difficulty climbing SMOOTHLY. A single big jump fails it.
  let x = 20, speed = 2, score = 0, dir = 1, biggestJump = 0;
  function step() {
    x = x + speed * dir;
    if (x > 280 || x < 10) {
      dir = -dir;
      score = score + 1;
      const old = speed;
      speed = speed + 0.6;          // a slope, not a cliff
      biggestJump = Math.max(biggestJump, speed - old);
    }
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(x, 90, 16, 16);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("Level " + score + "   speed " + speed.toFixed(1), 10, 20);
    ctx.fillText("biggest jump so far: " + biggestJump.toFixed(1), 10, 40);
    if (score >= 6) {
      if (biggestJump <= 2) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Smooth climb!", 10, 180); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Difficulty jumped by " + biggestJump.toFixed(1) + " at once", 10, 180); }
      return;
    }
    requestAnimationFrame(step);
  }
  step();
code: |
  // The goal: reach level 6 with difficulty climbing SMOOTHLY. A single big jump fails it.
  let x = 20, speed = 2, score = 0, dir = 1, biggestJump = 0;
  function step() {
    x = x + speed * dir;
    if (x > 280 || x < 10) {
      dir = -dir;
      score = score + 1;
      const old = speed;
      if (score === 3) speed = 20;   // trivial, then suddenly impossible
      biggestJump = Math.max(biggestJump, speed - old);
    }
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(x, 90, 16, 16);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("Level " + score + "   speed " + speed.toFixed(1), 10, 20);
    ctx.fillText("biggest jump so far: " + biggestJump.toFixed(1), 10, 40);
    if (score >= 6) {
      if (biggestJump <= 2) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Smooth climb!", 10, 180); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Difficulty jumped by " + biggestJump.toFixed(1) + " at once", 10, 180); }
      return;
    }
    requestAnimationFrame(step);
  }
  step();
```

A curve is a design decision made out of numbers. Getting it wrong is not a bug — the game still runs, it just stops being worth playing.

```quiz
question: Players keep quitting at your hardest level. Which change is most likely to help WITHOUT making the level easier?
options:
  - Restart them right before the hard bit instead of at the beginning
  - Add more enemies so it feels busier
  - Make the level longer
  - Remove the score display
answer: 0
feedback:
  - Right. Same difficulty, much cheaper failure — so people keep trying.
  - More enemies makes it harder, which is the opposite.
  - A longer level makes each failure cost more.
  - The score isn't what's stopping them.
explain: Lowering the cost of failing lets players attempt something hard many times, which is when hard becomes fun instead of annoying.
```

Your game almost certainly has one difficulty setting that never changes. That is a flat line, and a flat line is the thing this whole lesson is against.

```yourturn
title: Put a slope in your game
task: Find the thing in your game that could get harder, and make it climb a little at a time instead of staying flat or jumping.
steps:
  - Open `config.js` in the Code tab.
  - Find a number that controls difficulty — enemy speed, spawn rate, how much time you get.
  - Make it change as the player does well. A small step each time, not a doubling.
  - Check the cost of failing. If dying sends the player back to the very start, try putting them back near where they died instead.
  - Press Run and play until you lose twice. Did the second attempt feel worth making?
reward: Difficulty Designer badge
```

## Recap

- **Flow** is the band between bored and frustrated — and it moves as the player improves.
- Introduce **one new idea at a time**, somewhere failing is cheap, before combining it.
- Three dials: **speed**, **amount**, **room for error**. Turn them gradually.
- Cheap failure makes hard games fun. Expensive failure makes them quit.

goal: The speed climbs in small steps instead of jumping, with no sudden leap anywhere.