---
title: Ship It
xp: 240
ai: full
summary: Your game, your name on it, somebody else playing it.
---

A game nobody has played is not finished. It's a thing on your computer.

This is the last lesson of the course, and it's about the step most people never take. Not because
it's hard — because it's uncomfortable.

## Finishing is a decision, not an event

There is no moment when a game becomes done. There is always one more thing: another enemy, better
art, that bug nobody but you has noticed.

So finishing is something you **decide**. You pick a line, you stop adding, and you make what
exists work properly.

```run
// @goal: Add one more feature before you call it done. Then one more. When does it go out?
// @slider: extraFeatures 0 10 1 3
const daysEach = 4, finishing = 5;
console.log(extraFeatures + " more feature(s) first");
console.log("building them:                 " + extraFeatures * daysEach + " days");
console.log("finishing what already exists: " + finishing + " days");
console.log(extraFeatures === 0
  ? "Out in " + finishing + " days, and somebody else is playing it."
  : "Out in " + (extraFeatures * daysEach + finishing) + " days — if no new idea turns up in the meantime.");
```

Professionals do exactly this, with a name for each stage:

- **Feature freeze** — no new features. Only finishing what's already started.
- **Content lock** — no new levels or art. Only fixing what's there.
- **Ship** — it goes out.

Doing this yourself, on a small game, is worth more than adding two more features. It's the part
you can't practise any other way.

## The last-mile checklist

<figure class="art aside">
  <div class="art-row">
    <span class="art-cell"><img src="/assets/signExit.png" alt="An exit sign"><b>a way out</b></span>
    <span class="art-cell"><img src="/assets/flagGreen.png" alt="A green flag"><b>an end</b></span>
    <span class="art-cell"><img src="/assets/check-on.png" alt="A ticked checkbox"><b>it works</b></span>
  </div>
  <figcaption>The three things a player needs that you will forget, because you already know your
  own game: a way out, somewhere it ends, and the confidence that pressing things does something.
  <cite><b>Kenney</b> — Platformer &amp; UI packs, public domain (CC0).</cite></figcaption>
</figure>

The gap between "works for me" and "works for someone else" is almost always the same short list:

- **Can they tell what to do?** You know the controls. They don't. Put them on the screen.
- **Can they lose?** A game you can't lose is a toy. That's fine, but decide on purpose.
- **Can they start again without reloading?** Losing and being stuck is the fastest way to close a tab.
- **Does it start in a sensible state?** Not mid-level, not with your test values, not muted-but-appearing-unmuted.
- **Are the console errors gone?** Errors you have learned to ignore are still errors.
- **Does the first ten seconds make sense** to someone who has never seen it?

That last one carries the most weight, and it's the one you cannot check by yourself.

```quiz
question: What does "feature freeze" mean?
options:
  - Stop adding new things and finish what already exists
  - Pause the game
  - Freeze the frame rate
  - Stop working entirely
answer: 0
feedback:
  - Right. It is a line you draw so the game can actually be finished.
  - Nothing to do with pausing.
  - Nothing to do with frame rate.
  - It is the opposite — it is when the finishing work starts.
explain: Feature freeze is the decision to stop adding and start finishing. Without it, a project never ends.
```

## Watching somebody else play

<figure class="shot aside">
  <img src="/content/images/shots/asteroids-cabinet.jpg" alt="An Asteroids arcade cabinet, with its illustrated side art and control panel">
  <figcaption>The original playtest rig. An arcade cabinet earned money or it did not, and the
  designer could stand behind it and watch. You have the better version of this: a friend, a
  browser tab, and the discipline to say nothing while they play.
  <cite><b>Asteroids</b> cabinet — Atari. Used for teaching commentary; see
  CREDITS.md.</cite></figcaption>
</figure>

Here is the most valuable twenty minutes available to you, and almost nobody does it.

Sit someone in front of your game. **Say nothing.** Not one word, however much it hurts.

Everything you know about your own game is invisible to them. You know which button does what, what
the goal is, and which bits are unfinished. They know none of it, and the first thirty seconds of
watching somebody find that out is worth more than an hour of your own testing.
Watch where they hesitate. Watch what they try that you never considered. Watch the moment they get
stuck and their hand goes to the mouse to close the tab.

You will want to explain. Every explanation you give is a thing your game failed to say for itself —
and when it's on the internet, you won't be there to say it.

```run
// @goal: Count what you had to explain while they played. Each one is a thing the game did not say.
// @slider: explanations 0 8 1 4
console.log("twenty minutes sitting behind them");
console.log("times you opened your mouth: " + explanations);
console.log(explanations === 0
  ? "Nothing needed saying. The game said all of it itself."
  : explanations + " thing(s) your game failed to explain — and online you will not be there to help.");
console.log("that count is your fix list, and it is already in priority order.");
```

Write down what you saw, not what you'd like to be true. Then fix the top two things.

> If you have to explain it, it isn't explained.

## Putting your name on it

<figure class="shot">
  <img src="/content/images/shots/endless-sky-title.jpg" alt="The Endless Sky title screen: a spaceship over a planet with the game's name and a menu">
  <figcaption>A title screen is the cheapest thing in this list and the one that most changes whether
  a game looks finished. A name, a picture, and one button. Endless Sky is made by volunteers and
  given away free, and it still has this — because a game that opens straight into play reads as a
  demo, however good the play is.
  <cite><b>Endless Sky</b> 0.9.12 — Endless Sky developers, GPLv3.</cite></figcaption>
</figure>

Now the part that has nothing to do with code.

Publishing something you made is uncomfortable. It's yours, it isn't perfect, and you know every
flaw in it because you built each one personally.

Do it anyway. Every developer feels this, and the feeling doesn't go away with experience — people
who have shipped twenty games still feel it. What changes is that they've learned it's not a signal
to wait.

Your game doesn't have to be good. It has to **exist**, and be findable, and have your name on it.
That's what makes you someone who ships things rather than someone with a folder of unfinished
projects.

```challenge
title: Lab — the game that breaks for everyone else
task: This game works perfectly for the person who wrote it and fails for everybody else. Go through the checklist and find what is missing.
hint: Two things are wrong. Look at the values it starts with, and at what happens after the player loses.
solution: |
  // The goal: start in a sensible state, and be restartable after losing.
  let score = 0;            // a real starting score, not a test value
  let lives = 3;
  let canRestart = true;    // losing is not the end of the road
  let ticks = 0;
  const problems = [];
  function check() {
    problems.length = 0;
    if (score !== 0) problems.push("starts with a test score");
    if (!canRestart) problems.push("no way to start again after losing");
  }
  function step() {
    ticks = ticks + 1;
    if (ticks % 10 === 0 && lives > 0) lives = lives - 1;
    check();
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("score " + score + "   lives " + lives, 10, 28);
    ctx.fillText("restart available: " + canRestart, 10, 50);
    problems.forEach(function (p, i) { ctx.fillText("- " + p, 10, 80 + i * 20); });
    if (lives <= 0) {
      if (problems.length === 0) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Ready for someone else.", 10, 150); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText(problems.length + " thing(s) still wrong.", 10, 150); }
      return;
    }
    if (ticks < 100) requestAnimationFrame(step);
  }
  step();
code: |
  // The goal: start in a sensible state, and be restartable after losing.
  let score = 4200;         // left over from testing that boss fight
  let lives = 3;
  let canRestart = false;   // lose and the tab is your only way out
  let ticks = 0;
  const problems = [];
  function check() {
    problems.length = 0;
    if (score !== 0) problems.push("starts with a test score");
    if (!canRestart) problems.push("no way to start again after losing");
  }
  function step() {
    ticks = ticks + 1;
    if (ticks % 10 === 0 && lives > 0) lives = lives - 1;
    check();
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("score " + score + "   lives " + lives, 10, 28);
    ctx.fillText("restart available: " + canRestart, 10, 50);
    problems.forEach(function (p, i) { ctx.fillText("- " + p, 10, 80 + i * 20); });
    if (lives <= 0) {
      if (problems.length === 0) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Ready for someone else.", 10, 150); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText(problems.length + " thing(s) still wrong.", 10, 150); }
      return;
    }
    if (ticks < 100) requestAnimationFrame(step);
  }
  step();
```

Both of those are real, and both are the kind of thing you stop seeing after the fiftieth time you
open your own game.

```quiz
question: You are watching someone play your game and they get stuck. What should you do?
options:
  - Say nothing and write down where they got stuck
  - Explain how that part works
  - Take the controls and show them
  - Tell them they are doing it wrong
answer: 0
feedback:
  - Right. Every explanation you give is something your game failed to say for itself.
  - Helping feels kind and destroys the information you came for.
  - Now you are playing your own game, which you already know how to do.
  - They are doing exactly what a real player would do — that IS the finding.
explain: A playtest measures what your game communicates without you. The moment you speak, you stop measuring it.
```

This is the part that turns a project into a game other people have played. Everything up to now was for you; this is for them.

```yourturn
title: Walk the checklist once
task: Not publishing yet — that is the checkpoint after this. This is the read-through, so you know what you are dealing with before you start fixing anything.
steps:
  - Open the Code tab and go through the last-mile checklist above, one line at a time.
  - 'Write what you find in `design.md`, at the bottom, under a heading called `## Before it ships`.'
  - Be honest and be specific. "The jump is weird" is not a note; "the jump feels floaty at the top" is.
  - Do not fix anything yet. A list you wrote before you started fixing is the only one that is not a list of what you happened to notice while fixing.
reward: Last Mile badge
```

## Recap

- A game nobody has played is **not finished**.
- **Finishing is a decision**: feature freeze, content lock, ship.
- The last mile is nearly always the same list — controls shown, losing possible, restart without
  reloading, sensible starting state, no console errors.
- **Watch someone play and say nothing.** If you have to explain it, it isn't explained.
- Publishing feels uncomfortable for everyone, always. Do it anyway.

goal: Every item on the checklist passes, so the game runs somewhere other than here.