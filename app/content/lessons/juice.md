---
title: Juice
xp: 220
ai: full
summary: The difference between "it works" and "it feels good".
---

Two games. Identical rules, identical controls, identical everything you could write down.

One feels amazing. The other feels like a spreadsheet.

All of the difference is in this lesson, and none of it changes what the game *does*.

## What juice actually means

**Juice** is everything a game adds that doesn't change the rules but makes doing things feel
good. The squash when a character lands. The screen jolting when something explodes. The score
number that swells and shrinks instead of just changing.

None of it affects whether you win. All of it affects whether you want to keep playing.

The clearest way to see it: play Vampire Survivors, or a Mario game, and imagine the same game with
every effect stripped out. Same rules, same difficulty, completely dead.

> Juice is the difference between pressing a button and *doing something*.

## Screen shake, and how much is too much

Shaking the whole screen for a few frames is the single most effective effect for its cost. Three
lines of code, and hits suddenly land.

It's also the most overused thing in game development, and it goes wrong in a specific way:

- **Too big** and the player can't see what's happening.
- **Too long** and it feels like a bug.
- **Too often** and it stops meaning anything.

Rules of thumb worth starting from: under 200 milliseconds, only for genuinely big moments, and
scale it with importance. A small hit gets a nudge; the boss dying gets a jolt.

**If everything shakes, nothing does.** Shake is a way of saying "this one matters" — which only
works if most things don't.

```quiz
question: Every hit in your game shakes the screen hard. Why is that a problem?
options:
  - If everything shakes, shaking stops meaning "this one matters"
  - Screen shake slows the game down
  - Players cannot see screen shake
  - Shaking is always a bad idea
answer: 0
feedback:
  - Right. Emphasis only works when most things are not emphasised.
  - It costs almost nothing to run.
  - They see it — that is rather the problem.
  - Used sparingly it is the best value effect there is.
explain: Effects communicate importance by contrast. If every event is loud, the player learns to ignore all of them.
```

## Tweens: smooth beats instant

A **tween** changes a value gradually instead of instantly. Instead of a coin vanishing, it flies
toward the score while shrinking, and disappears when it arrives.

```
this.tweens.add({
  targets: coin,
  y: coin.y - 30,
  alpha: 0,
  duration: 300
});
```

Rise thirty pixels, fade out, over three tenths of a second.

Why it's worth it: **an instant change is easy to miss.** Something that moves draws your eye and
tells you where to look. A score that pops up and drifts toward the counter is teaching the player
where their points went.

The one to be careful with is **duration**. Anything the player is waiting on should be under about
200ms. Decoration can be slower. A tween that makes someone wait is not juice, it's lag.

## Particles, and knowing when to stop

Particles are lots of small things thrown out at once — sparks, dust, smoke. Great for impacts, and
the easiest effect to overdo.

The honest advice: add half of what you think you want. Then play it twenty times in a row. Effects
that felt great on the first go are frequently exhausting by the tenth, and you are the person
least able to judge that, because you've seen it more than anyone.

Which points at the real rule for this whole lesson: **juice is tuned by playing, not by reading.**
There is no correct number for shake duration. Set it, play it, change it, play it again.

```challenge
title: Lab — mechanically perfect, completely flat
task: Nothing here is broken. It just feels like nothing. Add the feel — the hit should be obvious on more than one channel.
symptoms:
  - The hit changes a number and nothing else happens
  - The hit is not being detected
  - The score is going up too slowly
answer: 0
hint: You have `shake` and `pop` sitting there unused. Set them when a hit lands, and let them fade back down each frame.
solution: |
  // The goal: a hit must land on at least two channels — movement AND scale, not just a number.
  let score = 0, shake = 0, pop = 0, ticks = 0, channels = 0;
  function hit() {
    score = score + 1;
    shake = 6;                       // the screen jolts
    pop = 8;                         // and the target swells
  }
  function step() {
    ticks = ticks + 1;
    if (ticks % 8 === 0) hit();
    const offsetX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const size = 40 + pop;
    if (shake > 0) shake = shake - 1;
    if (pop > 0) pop = pop - 1;
    channels = (shake > 0 || offsetX !== 0 ? 1 : 0) + (pop > 0 ? 1 : 0);
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#d64545";
    ctx.fillRect(150 - size / 2 + offsetX, 100 - size / 2, size, size);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("score " + score, 10, 25);
    if (score >= 3 && channels >= 2) { ctx.fillStyle = "#3ddc84"; ctx.fillText("That has some weight to it.", 10, 185); win(); return; }
    if (ticks < 80) requestAnimationFrame(step);
    else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Works. Feels like nothing.", 10, 185); }
  }
  step();
code: |
  // The goal: a hit must land on at least two channels — movement AND scale, not just a number.
  let score = 0, shake = 0, pop = 0, ticks = 0, channels = 0;
  function hit() {
    score = score + 1;
    // the number goes up. that is the entire event.
  }
  function step() {
    ticks = ticks + 1;
    if (ticks % 8 === 0) hit();
    const offsetX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const size = 40 + pop;
    if (shake > 0) shake = shake - 1;
    if (pop > 0) pop = pop - 1;
    channels = (shake > 0 || offsetX !== 0 ? 1 : 0) + (pop > 0 ? 1 : 0);
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#d64545";
    ctx.fillRect(150 - size / 2 + offsetX, 100 - size / 2, size, size);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("score " + score, 10, 25);
    if (score >= 3 && channels >= 2) { ctx.fillStyle = "#3ddc84"; ctx.fillText("That has some weight to it.", 10, 185); win(); return; }
    if (ticks < 80) requestAnimationFrame(step);
    else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Works. Feels like nothing.", 10, 185); }
  }
  step();
```

```quiz
question: How should you decide how long a screen shake lasts?
options:
  - Set a value, play it, change it, play it again
  - Work it out from the frame rate
  - Copy whatever another game uses
  - Make it as long as possible
answer: 0
feedback:
  - Right. There is no correct number — juice is tuned by playing.
  - The maths tells you nothing about how it feels.
  - A reasonable starting point, but their game is not yours.
  - Long shakes read as bugs.
explain: Juice has no right answer, only a right feel. The method is always set it, play it, adjust.
```

```yourturn
title: Juice up your best moment
task: Take the single best moment in your game and make it feel three times bigger.
steps:
  - Open the Code tab and find your most important moment — the collect, the kill, the win.
  - Add a tween: make something grow and shrink, or rise and fade, when it happens.
  - Add a short screen shake with `this.cameras.main.shake(120, 0.01)` — small numbers first.
  - Press Run and do it ten times in a row. If you are bored by the tenth it is too little; if you are tired by the tenth it is too much.
  - Then go and check nothing ELSE in your game shakes, or this one stops feeling special.
reward: Juice Master badge
```

## Recap

- **Juice** is everything that makes a game feel good without changing the rules.
- **Screen shake** is the best value effect there is, and the easiest to overdo. If everything
  shakes, nothing does.
- **Tweens** make change gradual, which draws the eye. Keep anything the player waits on under
  ~200ms.
- **Particles**: add half what you want, then play it twenty times.
- Juice is **tuned by playing, not by reading**. There is no correct number.
