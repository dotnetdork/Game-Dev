---
title: Values and Variables
xp: 200
ai: full
summary: The things your game remembers.
---

Your score. Where the player is standing. How many lives are left. Whether the door is open.

All of those are the same idea wearing different names: something the game **remembers** while it's
running. In code, that's a **variable**.

## A box with a name on it

A variable is a labelled box. You put something in it, and later you can look at it or swap it for
something else.

```run
// @goal: Run this and watch the box change.
let score = 0;
console.log("start: " + score);
score = 10;
console.log("after scoring: " + score);
score = score + 5;
console.log("after 5 more: " + score);
```

That third line is the one that trips people up. `score = score + 5` is not claiming a number
equals itself plus five — that would be nonsense. It's an instruction:

> Work out `score + 5`. Put the answer back in `score`.

Right-hand side first, then the box gets the result. Read it that way once and it never confuses
you again.

## Numbers, words and true/false

Three kinds cover almost everything a game needs:

| Kind | Looks like | Used for |
|---|---|---|
| **Number** | `0`, `250`, `-3.5` | Score, position, speed, lives |
| **Text** | `"Game Over"`, `"player"` | Names, messages, asset keys |
| **True/false** | `true`, `false` | Is the door open? Is the player alive? |

The true/false one is called a **boolean**, and beginners under-use it. If your code says
`let doorState = 1` and you have to remember that 1 means open, use `let doorOpen = true` instead.

```quiz
question: After these three lines, what is in `lives`?  `let lives = 3;`  `lives = lives - 1;`  `lives = lives - 1;`
options:
  - 1
  - 3
  - 2
  - 0
answer: 0
feedback:
  - Right — 3, then 2, then 1. Each line takes the current value and puts a new one back.
  - It changed twice after being set.
  - That is after one subtraction, not two.
  - That would need three subtractions.
explain: Each `lives = lives - 1` works out the right-hand side first, then puts the answer back in the box.
```

## Changing what is in the box

Three words make a variable, and the difference matters:

- **`let`** — a box whose contents can change. Score, position, lives.
- **`const`** — a box whose contents must not change. Settings, speeds you tune once.
- **`var`** — the old way. You'll see it in old code. Don't use it in new code.

Prefer `const` where you can. If a value shouldn't change halfway through, saying so means the
computer catches you when you accidentally change it — instead of you finding out from a bug.

## Names you will thank yourself for

Compare these:

```
let x = 220;
let playerWalkSpeed = 220;
```

Both work. In three weeks, only one still makes sense. Naming isn't decoration — it's the comment
you don't have to write.

Two rules that will serve you well. Say what the value **is**, not what type it is: `playerSpeed`,
not `speedNumber`. And if a name needs a comment to explain it, the name is wrong.

```challenge
title: Lab — the score that forgets
task: The score goes up and then straight back to zero. Work out where the value is being lost.
hint: Look at where `score` is created. Is that inside the loop or outside it? A box made new each time cannot remember anything.
solution: |
  // The goal: reach a score of 5. The score has to survive from one go to the next.
  let score = 0;                 // made ONCE, outside the loop, so it remembers
  let round = 0;
  function collect() {
    round = round + 1;
    score = score + 1;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "15px sans-serif";
    ctx.fillText("round " + round, 10, 30);
    ctx.fillText("score " + score, 10, 60);
    if (score >= 5) { ctx.fillStyle = "#3ddc84"; ctx.fillText("It remembered!", 10, 100); win(); return; }
    if (round < 20) requestAnimationFrame(collect);
  }
  collect();
code: |
  // The goal: reach a score of 5. The score has to survive from one go to the next.
  let round = 0;
  function collect() {
    let score = 0;               // a brand new box, every single time
    round = round + 1;
    score = score + 1;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "15px sans-serif";
    ctx.fillText("round " + round, 10, 30);
    ctx.fillText("score " + score, 10, 60);
    if (score >= 5) { ctx.fillStyle = "#3ddc84"; ctx.fillText("It remembered!", 10, 100); win(); return; }
    if (round < 20) requestAnimationFrame(collect);
  }
  collect();
```

```quiz
question: Which is the best name for a value holding how fast the player walks?
options:
  - playerWalkSpeed
  - x
  - speedNumber
  - psw
answer: 0
feedback:
  - Right. It says what it is, and still makes sense in three weeks.
  - Fine for a moment, meaningless tomorrow.
  - "Number" describes the type, which you can already see. It adds nothing.
  - Short, and unreadable to everyone including future you.
explain: A good name says what the value IS. If it needs a comment to explain it, the name is wrong.
```

```yourturn
title: Give your game something new to remember
task: Add one value your game does not track yet, and show it on screen.
steps:
  - Open the Code tab and open game.js.
  - Pick something worth remembering — coins collected, jumps made, seconds survived.
  - Create it near the top with `let`, starting at 0, so it lives outside the loop and survives.
  - Add 1 to it in the right place, then draw it with a text object so you can watch it work.
  - Press Run and check the number actually climbs.
reward: Bookkeeper badge
```

## Recap

- A **variable** is a named box holding something your game needs to remember.
- `score = score + 5` means *work out the right side, then put it back in the box*.
- Three kinds cover nearly everything: **number**, **text**, **true/false**.
- Use **`const`** when a value should not change, **`let`** when it should. Avoid `var`.
- A variable made **inside** a loop is new every time and cannot remember anything.
- **Names are the comment you do not have to write.**
