---
title: Scenes, create and update
xp: 220
ai: full
summary: Why one part of your game runs once and the other runs forever.
---

There are exactly two moments in a Phaser game: the moment the world gets built, and every moment
after it.

Two functions, one for each. Getting them the wrong way round is the most common mistake in this
whole course — and once you've seen it, you'll spot it instantly forever.

## create(): building the world once

`create()` runs **one time**, when the scene starts. It's where you make things exist.

- Draw the background.
- Put the player somewhere.
- Create the score text.
- Set up which things should collide.

Think of it as setting out a board game: pieces on the board, rules agreed, before anyone moves.

## update(): every frame, forever

`update()` runs **about sixty times a second**, for as long as the scene is open. It's where things
change.

- Read the keys and move the player.
- Move the enemies.
- Check whether anything has fallen off the bottom.
- Update the score display.

Board game again: this is the playing.

```quiz
question: Where should you create the player's score text object?
options:
  - In create(), because it only needs making once
  - In update(), so it stays fresh
  - In both, to be safe
  - Neither — Phaser makes it automatically
answer: 0
feedback:
  - Right. Make it once; change its contents later with setText().
  - That would make a brand new text object sixty times a second, stacking thousands of them up.
  - Making it twice is one more than necessary.
  - Phaser does not know what your game needs.
explain: Things are MADE in create() and CHANGED in update(). Creating in update() makes a new one every frame.
```

<figure class="diagram">
  <img src="/content/images/create-vs-update.svg" alt="A timeline showing create running once at the start, then update running on every frame afterwards.">
  <figcaption>One tick for <code>create</code>. Sixty ticks a second, forever, for <code>update</code>. Every mistake in this lesson comes from putting something in the wrong one.</figcaption>
</figure>

## What belongs where

The question to ask is: **does this need to happen again?**

| Job | Where | Why |
|---|---|---|
| Load the level background | `create()` | It doesn't change |
| Make the player sprite | `create()` | There's only one |
| Set up a collider | `create()` | It keeps working once registered |
| Read the arrow keys | `update()` | They change constantly |
| Move an enemy | `update()` | That's what moving means |
| Change the score text | `update()` | The number changes |

Notice that colliders go in `create()` even though collisions happen constantly. You're not
checking the collision — you're telling Phaser *to check it from now on*. Registering the rule
happens once; applying it happens every frame, and Phaser does that part.

## The classic mistake

<figure class="shot">
  <img src="/content/images/shots/supertux-boss.jpg" alt="A SuperTux boss fight: Tux facing a large enemy on a platform with a health indicator">
  <figcaption>A boss fight is <code>create()</code> and <code>update()</code> at their most obvious.
  The arena, the boss and its health bar are built once, on arrival. Everything after that — the
  boss moving, your hits landing, the bar shrinking — is <code>update()</code>. Build the arena in
  <code>update()</code> and you get a new boss sixty times a second.
  <cite><b>SuperTux</b> — SuperTux Development Team, screenshot by Dexxor, GPL.</cite></figcaption>
</figure>

Here it is, so you recognise it when you write it:

```
function update() {
  const scoreText = this.add.text(16, 16, "Score: " + score);
}
```

That looks harmless. It creates a text object — sixty times a second. After ten seconds there are
six hundred text objects stacked exactly on top of each other. The game gets slower and slower, and
the text looks strangely bold because it's six hundred copies.

**The symptom is always the same:** the game starts fine and gradually grinds to a halt. If that
happens, something is being created in `update()` that should have been created in `create()`.

```challenge
title: Lab — the world built sixty times a second
task: Something that should happen once is happening every frame, and it is piling up. Move it to where it belongs.
hint: Count what `made` reaches. Should the game really be making a new label on every single frame, or making one and changing it?
solution: |
  // The goal: finish 40 frames having made only ONE label. Make once, change after.
  let frames = 0, score = 0, made = 0;
  let label = null;
  function create() {
    label = { text: "Score: 0" };     // made exactly once
    made = made + 1;
  }
  function update() {
    frames = frames + 1;
    score = score + 1;
    label.text = "Score: " + score;   // changed, not remade
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "14px sans-serif";
    ctx.fillText(label.text, 10, 30);
    ctx.fillText("labels made: " + made, 10, 55);
    if (frames >= 40) {
      if (made === 1) { ctx.fillStyle = "#3ddc84"; ctx.fillText("One label. Correct.", 10, 90); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Made " + made + " labels — they are stacking up.", 10, 90); }
      return;
    }
    requestAnimationFrame(update);
  }
  create();
  update();
code: |
  // The goal: finish 40 frames having made only ONE label. Make once, change after.
  let frames = 0, score = 0, made = 0;
  let label = null;
  function create() {
    // nothing made here yet
  }
  function update() {
    frames = frames + 1;
    score = score + 1;
    label = { text: "Score: " + score };   // a brand new label, every single frame
    made = made + 1;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "14px sans-serif";
    ctx.fillText(label.text, 10, 30);
    ctx.fillText("labels made: " + made, 10, 55);
    if (frames >= 40) {
      if (made === 1) { ctx.fillStyle = "#3ddc84"; ctx.fillText("One label. Correct.", 10, 90); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Made " + made + " labels — they are stacking up.", 10, 90); }
      return;
    }
    requestAnimationFrame(update);
  }
  create();
  update();
```

```quiz
question: Your game runs fine for ten seconds and then gets slower and slower. What is the most likely cause?
options:
  - Something is being created in update() that should be created in create()
  - The player is moving too fast
  - The background image is too big
  - Gravity is set too high
answer: 0
feedback:
  - Right. Objects piling up sixty times a second is the classic gradual slowdown.
  - Speed does not accumulate.
  - A big background is slow from the very first frame, not gradually.
  - Gravity does not affect performance.
explain: Gradual slowdown means something is accumulating. Creating objects in update() adds sixty a second forever.
```

```yourturn
title: Check your own create and update
task: Read both functions in your game and make sure nothing that should happen once is happening every frame.
steps:
  - Open the Code tab and open game.js.
  - 'Read `update()` line by line, asking each one: does this need to happen again next frame?'
  - Look especially for `this.add.` anything — that means "make a new one", and it almost always belongs in create().
  - Move anything you find into `create()`, keeping a reference to it so update() can still change it.
  - Press Run and play for thirty seconds. It should feel exactly as fast at the end as at the start.
reward: Scene Setter badge
```

## Recap

- **`create()`** runs once, at the start. It's where things are **made**.
- **`update()`** runs every frame, forever. It's where things **change**.
- Ask: *does this need to happen again?* If not, it belongs in `create()`.
- Colliders are registered in `create()` — you're setting up the rule, not doing the check.
- **Gradual slowdown** almost always means something is being created in `update()`.
