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

Professionals do exactly this, with a name for each stage:

- **Feature freeze** — no new features. Only finishing what's already started.
- **Content lock** — no new levels or art. Only fixing what's there.
- **Ship** — it goes out.

Doing this yourself, on a small game, is worth more than adding two more features. It's the part
you can't practise any other way.

## The last-mile checklist

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

Here is the most valuable twenty minutes available to you, and almost nobody does it.

Sit someone in front of your game. **Say nothing.** Not one word, however much it hurts.

Watch where they hesitate. Watch what they try that you never considered. Watch the moment they get
stuck and their hand goes to the mouse to close the tab.

You will want to explain. Every explanation you give is a thing your game failed to say for itself —
and when it's on the internet, you won't be there to say it.

Write down what you saw, not what you'd like to be true. Then fix the top two things.

> If you have to explain it, it isn't explained.

## Putting your name on it

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

```yourturn
title: Publish your game
task: Give it a title and put it in the Gallery. This is the last step of the course and the one that counts.
steps:
  - Open the Code tab and go through the last-mile checklist above, one line at a time.
  - Fix the two most embarrassing things you find. Not all of them — two.
  - Sit somebody in front of it and say nothing for two minutes. Write down where they hesitated.
  - Fix the top thing they struggled with.
  - Open the Gallery from the top bar, press Publish my game, and give it a name you are happy to have next to your own.
reward: Published badge
```

## Recap

- A game nobody has played is **not finished**.
- **Finishing is a decision**: feature freeze, content lock, ship.
- The last mile is nearly always the same list — controls shown, losing possible, restart without
  reloading, sensible starting state, no console errors.
- **Watch someone play and say nothing.** If you have to explain it, it isn't explained.
- Publishing feels uncomfortable for everyone, always. Do it anyway.
