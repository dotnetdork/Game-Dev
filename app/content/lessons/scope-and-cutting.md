---
title: Scope and Cutting
xp: 200
ai: full
summary: Why your first idea is too big, and why that is completely normal.
---

Your idea is too big. Not because you had a bad idea — because everybody's first idea is too big,
including the people who do this for a living. The difference is that they know it, and they cut.

**Scope** is how much game there is. It is the single most common reason a project never gets
finished, and it is almost never a coding problem.

```run
// @goal: Add features and watch the finish date run away from you. Drag it.
// @slider: features 1 12 1 3
const daysEach = 4;                       // being generous, for somebody learning
const classesLeft = 10;                   // one class a week, ten weeks
const daysAvailable = classesLeft * 1;    // one useful day of building per class
const needed = features * daysEach;
console.log(features + " features x " + daysEach + " days = " + needed + " days of work");
console.log("You have about " + daysAvailable + ".");
console.log("");
console.log(needed <= daysAvailable
  ? "That fits. You will actually finish this."
  : "You are " + (needed - daysAvailable) + " days over. Something here is not getting built.");
```

Nothing about that is pessimism. It is arithmetic, and it is the same arithmetic a studio does
before it agrees to make anything.

## Feature creep is not adding features

It is adding them *while you are still building the last one*. It feels like ambition and it works
like quicksand: the half-finished pile grows and nothing in it ever gets to be good.

The tell is a sentence starting with "ooh, and". "Ooh, and what if there were bosses." Every one of
those is a real idea, and every one of them belongs on a list for next time rather than in this
week.

```quiz
question: Two students each have ten weeks. One builds a platformer with one enemy that works perfectly. The other builds a platformer with six enemies, three of which are broken. Whose game is better?
options:
  - The one with a single enemy that works
  - The one with six enemies, because there is more to do
  - Neither, they are the same amount of work
  - The one with six enemies, because it looks more impressive
answer: 0
feedback:
  - Right. A game somebody can finish is worth more than a bigger game they cannot.
  - Three broken enemies are not three features. They are three bugs.
  - The six-enemy version is far more work — that is the point. It bought nothing with it.
  - Half-working things do not look impressive. They look half-working, which is worse than small.
explain: Finished beats big, every time. A small game that works is something you can show somebody; a big game that does not is a folder on your laptop.
```

## Cutting is a skill, not a punishment

Real studios cut hard. **Half-Life 2** cut most of a storyline. **The Legend of Zelda: Ocarina of
Time** cut an entire second dungeon world. Nobody remembers, because what shipped was good.

The question that does the work is: **what is the one thing that, if I took it away, this would
stop being my game?**

Keep that. Everything else is negotiable — including the things you like.

```run
// @goal: Sort your own list. Change how many you keep, and read what happens to the rest.
// @slider: keep 1 6 1 2
const wishlist = [
  "the disappearing platforms",     // your one change
  "a coin that runs away from you",
  "a boss at the end",
  "two-player mode",
  "a shop where you spend coins",
  "twenty levels"
];
console.log("BUILDING:");
wishlist.slice(0, keep).forEach(function (f) { console.log("   " + f); });
console.log("");
console.log("NEXT TIME:");
wishlist.slice(keep).forEach(function (f) { console.log("   " + f); });
console.log("");
console.log("Writing the second list down is what stops you thinking about it.");
```

That second list is not a graveyard. It is the reason you can stop worrying about those ideas and
go and build the first one properly.

## The rule of one

For a first game, aim for exactly this:

- **one** verb the player does
- **one** kind of thing that gets in the way
- **one** reason to keep going
- **one** way to lose

If you finish that with time left over, add a second of something. That is a much happier problem
than running out of weeks with six broken things.

Here is a project that did not do the arithmetic.

```challenge
title: Lab — the plan that does not fit
task: This plan is over budget and the check at the bottom keeps failing. Cut the wishlist down until the work fits the weeks you actually have.
goal: The plan reports that it fits, without you changing how long a feature takes or how many weeks there are.
hint: Do not touch `daysEach` or `weeks` — those are the real world. `wishlist` is the only honest thing to change.
solution: |
  // Cut the list until the plan fits. Do not change daysEach or weeks.
  const daysEach = 4;
  const weeks = 10;
  const wishlist = ["disappearing platforms", "a runaway coin"];

  const needed = wishlist.length * daysEach;
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
  ctx.fillText(wishlist.length + " features = " + needed + " days", 10, 20);
  ctx.fillText("you have " + weeks + " days", 10, 40);
  if (needed <= weeks) {
    ctx.fillStyle = "#3ddc84";
    ctx.fillText("This plan fits. Go and build it.", 10, 70);
    wishlist.forEach(function (f, i) { ctx.fillText("- " + f, 16, 100 + i * 16); });
    win();
  } else {
    ctx.fillStyle = "#f5b02e";
    ctx.fillText("Over by " + (needed - weeks) + " days.", 10, 70);
    ctx.fillText("Something on this list is not getting built.", 10, 90);
  }
code: |
  // Cut the list until the plan fits. Do not change daysEach or weeks.
  const daysEach = 4;
  const weeks = 10;
  const wishlist = [
    "disappearing platforms",
    "a runaway coin",
    "a boss at the end",
    "two-player mode",
    "a shop",
    "twenty levels"
  ];

  const needed = wishlist.length * daysEach;
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
  ctx.fillText(wishlist.length + " features = " + needed + " days", 10, 20);
  ctx.fillText("you have " + weeks + " days", 10, 40);
  if (needed <= weeks) {
    ctx.fillStyle = "#3ddc84";
    ctx.fillText("This plan fits. Go and build it.", 10, 70);
    wishlist.forEach(function (f, i) { ctx.fillText("- " + f, 16, 100 + i * 16); });
    win();
  } else {
    ctx.fillStyle = "#f5b02e";
    ctx.fillText("Over by " + (needed - weeks) + " days.", 10, 70);
    ctx.fillText("Something on this list is not getting built.", 10, 90);
  }
```

Notice what the lab would not let you do: pretend a feature takes less time than it does, or that
there are more weeks than there are. Those are the two lies every over-scoped project tells.

```quiz
question: You have three weeks left and five things on your list. What is the professional move?
options:
  - Pick the two that matter and finish them properly
  - Work faster and try to get all five in
  - Start all five so at least everything is begun
  - Ask for more weeks
answer: 0
feedback:
  - Right. This is exactly what a studio does, and it has a name — cutting scope.
  - '"Work faster" is not a plan. The five things still take as long as they take.'
  - Five begun and nothing finished is the worst possible outcome. Nobody can play a beginning.
  - Sometimes worth asking. But the deadline is usually the one thing that does not move.
explain: When the work does not fit the time, the work has to change — because the time will not. Choosing what to cut is the job.
```

Now do it to your own list, while it is still cheap.

```yourturn
title: Cut your own wishlist
task: You wrote three twists last lesson. Pick the one you are actually building and move the others into the "not building" box — in writing, where you can see it.
steps:
  - Open the Code tab and open `design.md`.
  - Look at your three twists. Pick **one**. Ask which one, if you took it away, would stop this being your game.
  - Leave that one under "What makes it mine" and delete the other two from there.
  - Paste them under "What I am NOT building", along with anything else you have been quietly hoping to fit in.
  - Press Save. That list is the reason you get to stop thinking about them.
reward: Scope Sense badge
check:
  - contains:
      file: design.md
      text: 'NOT building'
    hint: Keep the "What I am NOT building" heading in `design.md` — that box is the whole point of this step.
  - changed_at_least: 3
    hint: Nothing has changed in `design.md` yet. Move your spare ideas down into the "not building" box.
example: 'What I am NOT building: a boss fight, two-player mode, a shop. Next time.'
```

## Recap

- **Scope** is how much game there is, and too much of it is the commonest reason projects die.
- The maths is not pessimism. Features times days is a real number, and so is the weeks you have.
- **Feature creep** is adding things while the last one is still unfinished. Listen for "ooh, and".
- Cutting is a **skill**. Half-Life 2 and Ocarina of Time both cut huge amounts, and shipped.
- The question: **what would stop this being my game if I removed it?** Keep that.
- For a first game, the **rule of one** — one verb, one obstacle, one reason to continue, one way
  to lose.
