---
title: Game State
xp: 220
ai: full
summary: What your game is doing right now, and why that is one question.
---

Menu. Playing. Paused. Dead.

A traffic light has exactly the same problem your game does, and solves it the same way: at any
moment it is doing **one** thing, and which thing decides everything else.

<figure class="shot aside">
  <img src="/content/images/shots/supertux-menu.jpg" alt="The SuperTux main menu: a title screen with Start Game, Options and Quit over a snowy background">
  <figcaption>The game is not paused here and it is not playing either. It is in a third state, with
  its own rules about what the keys do. Every game you have played has this screen, and every one of
  them needed a word for the state it is in.
  <cite><b>SuperTux 0.5.1</b> — SuperTux Development Team, GPL.</cite></figcaption>
</figure>

## One question, a few answers

Your game is always in exactly one **state**. Not two. Not none.

```
let gameState = "playing";
```

That single value answers a surprising number of questions at once:

- Should the player be able to move? Only in `"playing"`.
- Should enemies spawn? Only in `"playing"`.
- Should pressing Space start a new game? Only in `"gameover"`.
- Should the pause menu be drawn? Only in `"paused"`.

One variable, and all of those become easy.

## Why a pile of true/false goes wrong

Here's what people write first, and it looks perfectly sensible:

```
let isPlaying = true;
let isPaused = false;
let isGameOver = false;
```

Three booleans. Three separate things to keep in step. And now count the combinations: **eight** of
them, of which only three make any sense.

What is your game doing when `isPlaying` and `isGameOver` are both true? Nothing sensible — but the
code can absolutely end up there, because nothing stops it. One forgotten line and the player is
dead and still moving, or paused and still being shot at.

> Three booleans have eight possible combinations. One state variable has three. Five of those
> eight are bugs waiting to be found.

```quiz
question: Why is one `gameState` variable safer than three separate true/false flags?
options:
  - It cannot be in two states at once, so impossible combinations cannot happen
  - It uses less memory
  - Text is faster to compare than true/false
  - Phaser requires it
answer: 0
feedback:
  - Right. One value means exactly one answer — "dead and playing" simply cannot be represented.
  - The memory difference is meaningless.
  - Comparing text is actually slightly slower. Safety is the point.
  - Phaser does not care either way.
explain: Separate flags allow combinations that make no sense. A single state variable makes those combinations impossible to write.
```

## Drawing the map of states

Before writing any code, it's worth sketching which states exist and what moves between them:

```
menu  --press start-->  playing
playing  --press P-->   paused
paused   --press P-->   playing
playing  --lives = 0--> gameover
gameover --press R-->   menu
```

That's a **state machine**, and it's one of those ideas that turns out to be everywhere once you
know the name. It's how traffic lights work, how vending machines work, and how enemy behaviour
works in almost every game you've played — the guard is *patrolling*, then *suspicious*, then
*chasing*, then *searching*.

Sketching it first is worth five minutes because it makes you notice missing arrows. Can you get
out of `gameover`? If there's no arrow leaving a state, the player is stuck there forever.

<figure class="diagram">
  <img src="/content/images/state-machine.svg" alt="Four states — title, playing, dying and gameover — with arrows showing the only allowed moves, and a dashed arrow from gameover back to playing.">
  <figcaption>Read it as a map: you are always in exactly one bubble, and you can only leave along an arrow. The dashed one back to <code>playing</code> is the one people forget.</figcaption>
</figure>

## Where the rules live

<figure class="shot">
  <img src="/content/images/shots/runescape-hud.jpg" alt="The RuneScape interface: a game view with panels for inventory, skills, combat and a chat box">
  <figcaption>Count the states this one screen implies: walking, in combat, in a menu, typing in
  chat, trading. Typing "attack" into the chat box must not swing your sword — and that rule only
  exists because somewhere in there, something knows which state the player is in. A pile of
  true/false flags is how this becomes unfixable.
  <cite><b>RuneScape</b> — Jagex. Used for teaching commentary; see
  CREDITS.md.</cite></figcaption>
</figure>

Once you have a state, `update()` gets a clear shape:

```
if (gameState === "playing") {
  movePlayer();
  moveEnemies();
  checkCollisions();
} else if (gameState === "paused") {
  drawPauseMenu();
} else if (gameState === "gameover") {
  drawGameOver();
  if (spacePressed) gameState = "menu";
}
```

Everything that should only happen while playing is inside one block. Adding a pause feature stops
being "find every place that moves something and add a check" — it becomes one branch.

```challenge
title: Lab — the game that is dead and alive
task: This game can be playing and game-over at the same time, and it shows. Replace the separate flags with one state so impossible combinations cannot happen.
hint: Count how many combinations `isPlaying` and `isGameOver` can be in. Which of them make sense? One `state` variable can only ever hold one answer.
solution: |
  // The goal: run 30 ticks and never once be in an impossible state.
  let state = "playing";               // exactly one answer, always
  let health = 3, ticks = 0, impossible = 0;
  function tick() {
    ticks = ticks + 1;
    if (state === "playing") {
      if (ticks % 6 === 0) health = health - 1;
      if (health <= 0) state = "gameover";
    }
    if (state === "playing" && state === "gameover") impossible = impossible + 1;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("state: " + state, 10, 30);
    ctx.fillText("health: " + health, 10, 50);
    ctx.fillText("impossible states seen: " + impossible, 10, 70);
    if (ticks >= 30) {
      if (impossible === 0) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Never in two states at once.", 10, 110); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Was dead AND playing " + impossible + " times.", 10, 110); }
      return;
    }
    requestAnimationFrame(tick);
  }
  tick();
code: |
  // The goal: run 30 ticks and never once be in an impossible state.
  let isPlaying = true, isGameOver = false;
  let health = 3, ticks = 0, impossible = 0;
  function tick() {
    ticks = ticks + 1;
    if (isPlaying) {
      if (ticks % 6 === 0) health = health - 1;
      if (health <= 0) isGameOver = true;    // and isPlaying is still true...
    }
    if (isPlaying && isGameOver) impossible = impossible + 1;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("playing: " + isPlaying + "   gameover: " + isGameOver, 10, 30);
    ctx.fillText("health: " + health, 10, 50);
    ctx.fillText("impossible states seen: " + impossible, 10, 70);
    if (ticks >= 30) {
      if (impossible === 0) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Never in two states at once.", 10, 110); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Was dead AND playing " + impossible + " times.", 10, 110); }
      return;
    }
    requestAnimationFrame(tick);
  }
  tick();
```

```quiz
question: You sketch your states and notice `gameover` has arrows going in but none coming out. What does that mean for the player?
options:
  - They get stuck there and can never start again
  - The game will run faster
  - Game over will never happen
  - Nothing — the last state does not need an exit
answer: 0
feedback:
  - Right. No way out means no way to play again, which is a bug you can spot before writing any code.
  - Speed is unaffected.
  - It happens fine. Leaving is the problem.
  - Unless you want the player to close the tab, it does.
explain: Sketching the states first makes missing transitions obvious. A state with no exit is a trap.
```

```yourturn
title: Give your game a real state
task: Replace at least one true/false flag with a single state value.
steps:
  - Open the Code tab and open game.js.
  - Find any true/false flags controlling what the game is doing — things like `isDead` or `started`.
  - Add `let gameState = "playing";` near the top.
  - In update(), wrap everything that should only happen while playing inside `if (gameState === "playing") { ... }`.
  - Set `gameState = "gameover"` where the player loses, and check the player really does stop moving.
reward: State Machinist badge
```

## Recap

- A game is always in exactly **one state**: menu, playing, paused, gameover.
- **Separate flags allow impossible combinations.** Three booleans have eight combinations; only
  three of them make sense.
- Sketch the **state machine** first — states and the arrows between them. Missing arrows are bugs
  you can catch before writing code.
- One state variable gives `update()` a clear shape and makes features like pause a single branch.
