---
title: Design on One Page
xp: 200
ai: full
summary: What a real design document looks like, and why yours fits on one page.
---

Studios write the game down before they build it. The document has a boring name — a **design
document** — and the version that actually gets used is one page long.

You have heard of the other kind: the four-hundred-page specification nobody reads. Those exist,
and they are mostly for people who have to sign things. The document the team actually keeps open
is called a **one-sheet**, and it is one page on purpose.

```run
// @goal: Why one page? Drag the page count and watch who is still reading.
// @slider: pages 1 40 1 1
const readAll = Math.max(0, Math.round(100 * Math.pow(0.82, pages - 1)));
console.log(pages + " page(s)");
console.log("teammates who read the whole thing:  " + readAll + "%");
console.log("");
console.log(pages <= 2
  ? "Everybody reads it. Everybody builds the same game."
  : "The rest are building whatever they remember, which is not the same game.");
```

A document nobody reads is worse than no document, because everybody thinks the plan is written
down.

## What a one-sheet is for

Not to describe the game. To **settle arguments before they cost anything**.

While it is a page, changing your mind is free. Once it is a thousand lines of code, changing your
mind costs a week. So the page exists to make you decide the expensive things early — and to make
you decide them *out loud*, in words you can check against later.

The slots are always roughly the same:

- **What it is**, in one sentence.
- **The verb** — what the player does.
- **How you win**, and **how you lose**.
- **What makes it different** from every other game in its genre.
- **What is not in it.**

```run
// @goal: The slots, as a checklist. Fill them in and watch it become buildable.
// @slider: slotsFilled 0 6 1 2
const slots = [
  "what it is, in one sentence",
  "the verb",
  "how you win",
  "how you lose",
  "what makes it different",
  "what is NOT in it"
];
slots.forEach(function (s, i) {
  console.log((i < slotsFilled ? "[x] " : "[ ] ") + s);
});
console.log("");
console.log(slotsFilled === 6
  ? "Somebody else could build this. That is the test."
  : "Missing " + (6 - slotsFilled) + ". A teammate would guess those, and guess wrong.");
```

That last slot — **what is not in it** — is the one amateurs leave out and professionals never do.

And that message the cell prints when all six are filled is the real test of a one-sheet: **could
somebody else build your game from it?** Not build it *well* — just build the right game. If they
would have to guess, the page is not finished.

```quiz
question: What is the actual job of a one-sheet?
options:
  - To make the expensive decisions while they are still cheap to change
  - To describe every detail of the game before you start
  - To prove to a teacher that you did some planning
  - To list everything you would like the game to have one day
answer: 0
feedback:
  - Right. On paper, changing your mind is free. In code, it costs a week.
  - Every detail is what the four-hundred-page version tries to do, and why nobody reads it.
  - If that is all it does, it is homework. A real one gets opened again while you build.
  - That is a wishlist. A one-sheet is mostly about what you are *not* doing.
explain: A one-sheet is a decision-making tool, not a description. Its value is that it makes you commit while committing is still cheap.
```

## Here is one, for a game you have already played

This is the starter game in your project, written as a one-sheet. Read it and notice how little
there is:

> **Coin Run** — a tiny platformer about grabbing everything before you fall.
>
> **The verb:** jump.
>
> **You win** by collecting all five coins. **You lose** by falling off the bottom.
>
> **What makes it different:** nothing yet. That is your job.
>
> **Not in it:** enemies, levels, a shop, a story, sound beyond a jump and a ding.

That is the whole design of a game you have been playing and editing for a week. Six lines — and
notice the last one especially. "Not in it" is not an apology. It is what let the game get finished
and be playable on your very first day.

## It is a living document

The word "document" makes this sound like something you hand in. It is not. It is behind the
**Design** tab at the top of this page, it is open the whole course, and you should expect to change
it — because every week from here you will know something you did not know when you wrote it.

```run
// @goal: The same page, read at different points in the course. Drag through and see what changes.
// @slider: week 1 6 1 1
const reads = [
  "you can only say what the player DOES. That is enough — it is the hardest line on the page",
  "you know what a core loop is, so 'you jump over things' becomes a loop that closes",
  "you know about feedback and difficulty, so 'how you lose' stops being an afterthought",
  "you have written code, so you can tell a line you could build from one you only like",
  "your game has grown, and half the page is about a game you are no longer making",
  "you are finishing, and the page is the list of what you promised yourself"
];
console.log("Week " + week + ", reading your one-sheet:");
console.log("   " + reads[week - 1]);
console.log("");
console.log("Same six boxes. The page does not change on its own — you do, and then you change it.");
```

So a plan that never changes was not a plan, it was a guess nobody checked.

```quiz
question: You are half way through building and you realise your "how you lose" idea is no fun. What should happen to the one-sheet?
options:
  - Change it, because you now know something you did not know when you wrote it
  - Leave it, because changing the plan is cheating
  - Delete it, because plans are useless once you start building
  - Keep building the boring version, because it is what you wrote down
answer: 0
feedback:
  - Right. Finding that out by building is exactly what building is for.
  - Nothing is being marked. The page exists to help you, so it should say what is true.
  - Then you would have no record of what you decided or why, which is how projects wander.
  - Now the page is making your game worse. That is the opposite of its job.
explain: A one-sheet is a living document. You revise it every time building teaches you something the page got wrong — which it will.
```

You already have one waiting on your Design tab, half filled in from the last two lessons.

```yourturn
title: Read your own one-sheet back
task: Read your board the way a stranger would, then fill in the worst gap it shows you.
steps:
  - Open the **Design** tab.
  - Press **Read it back as a stranger would** in the toolbar down the left. It runs your stickies together into the one paragraph somebody else would read, and names the boxes that are still empty.
  - Read that paragraph out loud if you can. The sentence you stumble over is the one to fix.
  - Fill in at least one of the boxes it says are missing. Click the sticky and type.
  - Add a note with **+** starting `TODO:` for whatever is still vague. It is your list for next week.
reward: One-Sheet badge
check:
  - contains:
      file: design.md
      text: 'TODO:'
    hint: Add a note on the board starting `TODO:` saying which boxes still need work.
example: 'TODO: how you lose is empty, and "what makes it mine" is still three things instead of one.'
```

## Recap

- Studios write the game down first. The version people actually use is a **one-sheet** — one page.
- Its job is to make the **expensive decisions while they are still cheap** — on paper, not in code.
- The slots: what it is, the verb, how you win, how you lose, what makes it different, **what is
  not in it**.
- The test: **could somebody else build the right game from this page?**
- It is a **living document**. You will change yours at the end of every module, and that is the
  point.
