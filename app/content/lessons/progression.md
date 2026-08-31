---
title: Progression
xp: 200
ai: full
summary: Why you come back tomorrow — and what makes a grind feel fair instead of pointless.
---

Here's an odd fact. RuneScape's skill bars, Fortnite's battle pass and Minecraft's diamond-to-
netherite ladder are, underneath, **the same machine**.

They all answer one question: *why should I play again tomorrow?*

## Progression is a promise

<figure class="art aside">
  <div class="art-row">
    <span class="art-cell"><img src="/assets/keyYellow.png" alt="A yellow key"><b>keyYellow</b></span>
    <span class="art-op">→</span>
    <span class="art-cell"><img src="/assets/door_closedMid.png" alt="A closed door"><b>closed</b></span>
    <span class="art-op">→</span>
    <span class="art-cell"><img src="/assets/door_openMid.png" alt="An open door"><b>open</b></span>
  </div>
  <figcaption>Progression in three pictures. The door is visible long before the key is findable —
  that is the promise. Show a player a locked door and they will remember where it was for an hour.
  <cite><b>Kenney</b> — Platformer Pack, public domain (CC0).</cite></figcaption>
</figure>

The core loop gives you something to do right now. Feedback tells you it worked. Difficulty keeps
it interesting. **Progression** is the part that says: *keep doing this and you will end up
somewhere better.*

It is also the part beginners skip, because nothing about a game breaks without it. Your game will
run perfectly happily with nothing to work toward. It will just be a thing people try once.
That promise is what turns a fun ten minutes into a game you come back to.

```run
// @goal: Two games, same unlock at 1000. One of them shows you where you are.
// @slider: points 0 1000 50 800
const need = 1000;
const pct = Math.round(points / need * 100);
const filled = Math.round(pct / 5);
console.log("game B:  Locked");
console.log("game A:  [" + "#".repeat(filled) + ".".repeat(20 - filled) + "]  "
  + pct + "%   " + (need - points) + " to go");
console.log(pct >= 70
  ? "At " + pct + "% almost nobody puts it down. Same unlock, different promise."
  : "Both players are equally far away. Only one of them knows it.");
```

Three things it can promise:

| Kind | What you get | Example |
|---|---|---|
| **Power** | You become able to do more | Better gear, a double jump, a new tool |
| **Access** | New places open up | A locked area, a new biome, the next world |
| **Show** | Something to display | A skin, a title, a number other people can see |

Power is the strongest for young players, because it changes what they can actually *do*. Show is
the weakest on its own — but it's the one that lasts longest once everything is unlocked.

## Why a visible bar matters so much

<figure class="shot">
  <img src="/content/images/shots/supertux-worldmap.jpg" alt="A SuperTux world map: a winding path of levels across an island, with completed levels marked and the path continuing off to the right">
  <figcaption>Progression made into a picture you can point at. Every dot is a level, the path
  behind you is finished, and the path ahead is <em>visible before you can reach it</em>. A player
  looking at this knows exactly how far they have come and roughly how much is left — which is the
  entire job. A percentage in a menu does the same arithmetic and none of the work.
  <cite><b>SuperTux</b> — SuperTux Development Team, screenshot by Dexxor, GPL. Open source, so you
  can go and read how this screen is built.</cite></figcaption>
</figure>

<figure class="shot aside">
  <img src="/content/images/shots/runescape-classic.jpg" alt="A small, low-resolution RuneScape Classic combat scene with chat text and skill panels">
  <figcaption>The other end of the same idea. RuneScape made the numbers themselves the reward, and
  people gave it years. That is a promise kept — and also a warning: the grind <em>is</em> the game
  here, which only works if the moment-to-moment is already good.
  <cite><b>RuneScape Classic</b> — Jagex. Used for teaching commentary; see CREDITS.md.</cite></figcaption>
</figure>

Fill in the blank: RuneScape doesn't just tell you your level. It shows you **exactly how far into
the next one you are.**

Hide it and the level still arrives at exactly the same moment — the player just has no idea it is
coming, so it lands as a surprise instead of as something they earned.
That bar is doing enormous work. A goal you can see yourself approaching is far more motivating
than one you can only reach. It's the difference between "get to level 40 someday" and "I'm 80%
through 39, I'll just finish this."

Look at the bottom of this app while you work through a lesson. Same trick. It isn't an accident.

```quiz
question: Two games both need 1,000 points for the next unlock. Game A shows a filling bar; Game B just says "Locked". Why does Game A keep more players?
options:
  - Seeing how close you are makes the goal feel reachable
  - A bar uses less memory than text
  - Game B's unlock must be worse
  - Players don't read text
answer: 0
feedback:
  - Exactly. Progress you can watch is far more motivating than progress you can only imagine.
  - Memory isn't the point here.
  - The unlocks could be identical — it's how progress is shown that differs.
  - They do read it. It just doesn't tell them how close they are.
explain: A visible bar turns a distant goal into a nearby one. "80% of the way there" pulls much harder than "locked".
```

## When a grind goes bad

"Grind" gets used as an insult, but repeating something to get better at it is the whole idea of a
game. What makes a grind feel *bad* is specific:

- **The reward is too far away.** Nothing to show for a whole session.
- **The steps are identical.** No variety, so it becomes work.
- **The reward doesn't change anything.** You got the thing, and you play exactly as before.
- **It isn't your choice.** You're grinding because the game blocked you, not because you wanted the
  thing.

Fixing a bad grind is usually about **more, smaller rewards** rather than making the big one
cheaper. Something every couple of minutes, something every session, something to aim at all week.

```run
// @goal: Space the rewards out, then bring them close. How long is the player left with nothing?
// @slider: minutesBetweenRewards 1 45 1 20
const session = 45;
const times = Math.floor(session / minutesBetweenRewards);
console.log("a 45-minute session, something good every " + minutesBetweenRewards + " minutes");
console.log("that is " + times + " good moment" + (times === 1 ? "" : "s") + " in the whole sitting");
console.log(minutesBetweenRewards <= 5
  ? "Never more than a few minutes from something. This is the fix for a bad grind."
  : "Long stretches with nothing to show for them — which is what people mean by grinding.");
```

> A player should never be more than a few minutes from *something* good happening.

## Careful: progression can eat your game

One warning, because it's easy to get wrong. If the rewards get big enough, players start playing
for the rewards instead of for the loop — and the moment the rewards stop, they quit, even though
the game underneath hasn't changed.

The loop has to be fun **before** you add progression. Progression is a reason to keep doing
something enjoyable, not a substitute for it.

Here's a progression that promises nothing.

```challenge
title: Lab — the progress that isn't progress
task: The player collects points forever and nothing ever changes. Give them something that actually arrives — a level, a visible bar, an ability that gets better.
hint: You have a `points` number and nothing reading it. Try working out a level from it, and drawing a bar showing how far into the next level they are.
solution: |
  // The goal: the player must actually REACH level 4. Points alone are not progression.
  let points = 0, level = 1;
  function collect() {
    points = points + 1;
    level = Math.floor(points / 5) + 1;     // points turn into something that arrives
  }
  function draw() {
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "16px sans-serif";
    ctx.fillText("Level " + level, 10, 26);
    ctx.font = "12px sans-serif";
    ctx.fillText(points + " points", 10, 46);
    const into = (points % 5) / 5;
    ctx.fillStyle = "#0d2440"; ctx.fillRect(10, 60, 280, 14);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(10, 60, 280 * into, 14);
    ctx.fillStyle = "#9fb2cc";
    ctx.fillText((5 - (points % 5)) + " to next level", 10, 92);
  }
  let t = 0;
  function step() {
    t = t + 1;
    if (t % 8 === 0) collect();
    draw();
    if (level >= 4) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Something arrived!", 10, 130); win(); return; }
    if (t < 400) requestAnimationFrame(step);
  }
  step();
code: |
  // The goal: the player must actually REACH level 4. Points alone are not progression.
  let points = 0, level = 1;
  function collect() {
    points = points + 1;
    // points go up. and up. and up. level never moves, so nothing ever arrives.
  }
  function draw() {
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "16px sans-serif";
    ctx.fillText("Level " + level, 10, 26);
    ctx.font = "12px sans-serif";
    ctx.fillText(points + " points", 10, 46);
    const into = (points % 5) / 5;
    ctx.fillStyle = "#0d2440"; ctx.fillRect(10, 60, 280, 14);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(10, 60, 280 * into, 14);
    ctx.fillStyle = "#9fb2cc";
    ctx.fillText((5 - (points % 5)) + " to next level", 10, 92);
  }
  let t = 0;
  function step() {
    t = t + 1;
    if (t % 8 === 0) collect();
    draw();
    if (level >= 4) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Something arrived!", 10, 130); win(); return; }
    if (t < 400) requestAnimationFrame(step);
  }
  step();
```

Progress has to arrive. A number climbing forever is not progress, it is arithmetic.

```quiz
question: Playtesters say your game "gets boring after five minutes" even though they like playing it. What's most likely missing?
options:
  - Progression — nothing is building toward anything
  - The core loop
  - Feedback
  - Difficulty
answer: 0
feedback:
  - Right. They enjoy the loop, so the loop works — what's missing is a reason to keep going.
  - If the loop were broken they wouldn't have enjoyed the first five minutes.
  - Feedback problems make a game feel broken immediately, not five minutes in.
  - Difficulty could be part of it, but "they like playing it" points at nothing to aim for.
explain: Enjoying it at first and stopping soon after is the classic sign of a good loop with nothing built on top of it.
```

Play your own game for two minutes and ask the honest question: is there any reason to start it a second time?

```yourturn
title: Give your player something to come back for
task: Add one thing that builds up across a whole session, and make it visible on screen the entire time.
steps:
  - Open the Code tab and decide what your player is working toward — a level, an upgrade, an area that opens up.
  - Work it out from a number you already track, like score. A level is often just score divided by something.
  - Draw it on screen, and draw how far into the next one they are. A bar beats a number.
  - Make it actually change something. A level that only changes a label is a label, not progression.
  - Press Run and play until you reach it once. Did getting there feel like anything?
reward: Progression Designer badge
```

## Recap

- **Progression** is the promise that playing again gets you somewhere better.
- Three kinds: **power**, **access**, **show**. Power is strongest for new players.
- **Show the bar.** Visible progress pulls far harder than a distant locked thing.
- Bad grinds are usually **rewards too far apart**, not too much repetition.
- Make the loop fun first. Progression is a reason to keep playing, not a replacement for fun.

goal: Something visibly arrives as you play — a level, a bar, an ability that gets better.