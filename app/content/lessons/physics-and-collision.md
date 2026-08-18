---
title: Physics and Collision
xp: 200
ai: full
summary: Why things fall and bounce — and why games only pretend to do real physics.
---

Drop a block in Minecraft and it falls. Nothing in that game knows what gravity is. There is no
equation about mass, no constant from a physics textbook. There is one number, added to another
number, sixty times a second.

Game physics is a **convincing fake**, and the fake is simpler than the real thing on purpose.

## Position, velocity, gravity

Three ideas, and you already understand all of them.

- **Position** — where something is. `x` and `y`.
- **Velocity** — how fast it is moving, and which way. Also `x` and `y`.
- **Gravity** — a small amount added to downward velocity, every single frame.

Every frame the engine does this:

```run
// @goal: Watch a ball fall. Change gravity and see what happens.
// @slider: gravity 0 2 0.1 0.5
let y = 0, velocityY = 0;
for (let frame = 1; frame <= 6; frame++) {
  velocityY = velocityY + gravity;   // gravity speeds it up
  y = y + velocityY;                 // velocity moves it
  console.log("frame " + frame + ": speed " + velocityY.toFixed(1) + ", height " + y.toFixed(1));
}
```

Notice the ball doesn't fall at a steady rate — it gets faster. That's because gravity adds to the
*speed*, and the speed adds to the *position*. Two additions, and you have something that looks
like the real world.

## Did these two boxes touch?

Collision sounds hard and mostly isn't. For two rectangles, the question "are these overlapping?"
is four comparisons: is A's left edge past B's right edge? Is A's right edge before B's left edge?
Same for top and bottom. If none of those are true, they're touching.

Engines wrap that up for you. In Phaser you say `this.physics.add.overlap(player, coins, grab)` and
it handles the rest.

There are two flavours, and picking the wrong one is a classic beginner bug:

| | What it does | Use it for |
|---|---|---|
| **overlap** | Tells you they touched, and lets them pass through | Collecting coins, walking into a trigger |
| **collider** | Tells you they touched, *and pushes them apart* | Walls, floors, bumping into an enemy |

```quiz
question: Your player walks straight through the coins without collecting them, but bounces off walls correctly. What is most likely wrong?
options:
  - The coins have no overlap check set up
  - Gravity is too strong
  - The coins are drawn behind the background
  - The player is moving too fast
answer: 0
feedback:
  - Right. Walls work, so collision itself is fine — the coins just have nothing watching them.
  - Gravity would affect falling, not whether a coin is noticed.
  - They would be invisible, but that is a drawing problem, not this one.
  - Speed can cause tunnelling, but then walls would fail too.
explain: Walls working proves the physics system is fine. If one specific pair does nothing, that pair has no overlap or collider set up.
```

## Why games fake it

Real physics is expensive to calculate and, more importantly, **not much fun**.

Mario's jump is nothing like a real jump. He rises too fast, hangs slightly at the top, and falls
faster than he rose. No object on Earth does that. It feels fantastic, which is why it has been
copied for forty years.

That's the rule: **game physics exists to feel good, not to be correct.** If real numbers feel bad,
use unreal numbers.

## When the fake breaks

The fake has edges, and it's useful to know where they are.

The famous one is **tunnelling**. If a bullet moves 40 pixels a frame and a wall is 20 pixels
thick, then on one frame the bullet is in front of the wall and on the next it's behind it. It was
never *inside* the wall, so nothing ever noticed a collision, and the bullet sails straight through.

If something fast is going through something thin, that's almost always why.

```challenge
title: Lab — the thing that will not fall
task: Gravity is in the code and nothing is falling. Work out what is missing between having a speed and actually moving.
hint: Follow the two steps. `velocityY` grows every frame — but is anything using it to change `y`?
solution: |
  // The goal: the ball must reach the ground. Gravity changes speed; speed must change position.
  let y = 10, velocityY = 0;
  const gravity = 0.6;
  let frames = 0;
  function step() {
    frames = frames + 1;
    velocityY = velocityY + gravity;
    y = y + velocityY;                 // the speed has to actually move it
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#f5b02e"; ctx.fillRect(140, y, 18, 18);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("height " + y.toFixed(0) + "   speed " + velocityY.toFixed(1), 10, 20);
    if (y >= 170) { ctx.fillText("It landed.", 10, 40); win(); return; }
    if (frames < 200) requestAnimationFrame(step);
  }
  step();
code: |
  // The goal: the ball must reach the ground. Gravity changes speed; speed must change position.
  let y = 10, velocityY = 0;
  const gravity = 0.6;
  let frames = 0;
  function step() {
    frames = frames + 1;
    velocityY = velocityY + gravity;   // the speed grows...
    // ...and nothing ever uses it
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#f5b02e"; ctx.fillRect(140, y, 18, 18);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("height " + y.toFixed(0) + "   speed " + velocityY.toFixed(1), 10, 20);
    if (y >= 170) { ctx.fillText("It landed.", 10, 40); win(); return; }
    if (frames < 200) requestAnimationFrame(step);
  }
  step();
```

```quiz
question: A fast bullet passes straight through a thin wall without ever colliding. What is happening?
options:
  - It moves further in one frame than the wall is thick, so it is never inside it
  - The wall has no colour
  - Gravity is pulling it through
  - Bullets cannot collide with walls
answer: 0
feedback:
  - Right — that is tunnelling, and it is the classic edge of how game physics fakes movement.
  - Colour has nothing to do with collision.
  - Gravity pulls down, not through.
  - They can, as long as the check gets a chance to notice.
explain: Collision is only checked once per frame. Something that jumps past a thin object between frames is never seen to touch it.
```

```yourturn
title: Tune the feel of your gravity
task: Change how heavy your game feels, and notice how much a single number changes it.
steps:
  - Open the Code tab and open config.js.
  - Find `gravity`. Halve it, press Run, and jump. Everything should feel floaty and slow.
  - Now double the original value and jump again. It should feel heavy and sharp.
  - Pick the value you actually like — not the realistic one, the one that feels good — and leave it there.
  - Try the same with `jumpPower` and see how the two work together.
reward: Physics Tinkerer badge
```

## Recap

- Game physics is three ideas: **position**, **velocity**, and **gravity** added every frame.
- Collision is mostly "do these two rectangles overlap?".
- **overlap** lets things pass through; **collider** pushes them apart.
- Games fake physics **because fake feels better**. Mario's jump is impossible and perfect.
- **Tunnelling** is the classic failure: something fast crossing something thin between frames.
