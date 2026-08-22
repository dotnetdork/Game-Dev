---
title: Input, Movement, Collision
xp: 220
ai: full
summary: The three verbs almost every game is built from.
---

Read the controls. Move things. Notice when they touch.

Nearly every game ever made is those three, arranged differently. Mario is those three. Minecraft
is those three. The game you're building is those three.

## Reading the keys

<figure class="art aside">
  <div class="art-row">
    <span class="art-cell"><img src="/assets/arrow-left.png" alt="Left arrow key"><b>left</b></span>
    <span class="art-cell"><img src="/assets/arrow-up.png" alt="Up arrow key"><b>up</b></span>
    <span class="art-cell"><img src="/assets/arrow-right.png" alt="Right arrow key"><b>right</b></span>
    <span class="art-op">→</span>
    <span class="art-cell"><img src="/assets/p1_jump.png" alt="The player in a jumping pose"><b>jump</b></span>
  </div>
  <figcaption>Three keys and one pose. The engine hands you nothing but "is left held down right
  now?" — everything the player experiences as <em>movement</em> is you turning that answer into a
  number, sixty times a second.
  <cite><b>Kenney</b> — Platformer Pack, public domain (CC0).</cite></figcaption>
</figure>

In `create()`, you ask Phaser to watch the arrow keys once:

```
this.cursors = this.input.keyboard.createCursorKeys();
```

Then in `update()`, every frame, you ask what they're doing:

```
if (this.cursors.left.isDown)  { ... }
if (this.cursors.right.isDown) { ... }
```

`isDown` means *held right now*, which is what you want for walking. There's also `JustDown`, which
is true for exactly one frame — that's what you want for jumping, so holding the key doesn't make
the player jump sixty times a second.

> Walking wants **isDown**. Jumping wants **JustDown**. Mixing them up is why a player sometimes
> flies off the top of the screen.

## Moving with velocity

There are two ways to move something, and one of them is a trap.

**Setting position directly** — `player.x = player.x + 5` — teleports it. The physics system knows
nothing about it, so it can pass through walls.

**Setting velocity** — `player.setVelocityX(200)` — tells the physics system *how fast it should be
going*, and lets it do the moving. Collision keeps working, gravity keeps applying, everything
behaves.

Use velocity. The numbers are in pixels per second, so `200` means it crosses a 800-wide screen in
four seconds.

```quiz
question: Your player moves fine but walks straight through walls. What is most likely wrong?
options:
  - Position is being set directly instead of using velocity
  - The walls are the wrong colour
  - The player sprite is too small
  - Gravity is switched off
answer: 0
feedback:
  - Right. Setting x directly teleports past the physics system, so nothing gets a chance to stop it.
  - Colour has no effect on collision.
  - Size affects where it touches, not whether touching is noticed at all.
  - Gravity pulls down; it does not stop sideways movement.
explain: Setting position directly bypasses physics. Setting velocity lets the physics system move it, so collisions still work.
```

## Noticing a touch

Two lines, two different jobs, and picking the wrong one is a classic bug:

```
this.physics.add.overlap(player, coins, collectCoin);
this.physics.add.collider(player, platforms);
```

- **overlap** — "tell me when these touch", and lets them pass through each other.
- **collider** — "tell me when these touch, **and push them apart**".

Coins want `overlap`: you walk into them and they vanish. Floors want `collider`: you land on them
and stop.

Both go in `create()`. You're registering the rule once; Phaser applies it every frame after that.

## Overlap or collide?

The way to decide is to ask: **should this thing block the player?**

| Thing | Which | Because |
|---|---|---|
| A coin | overlap | You walk through it and take it |
| The ground | collider | You stand on it |
| A checkpoint | overlap | You pass through and it triggers |
| A crate you push | collider | It's solid |
| A damage zone | overlap | You walk in and take damage |

If your player sticks to the coins instead of collecting them, you used `collider` where you wanted
`overlap`. If your player falls through the floor, the opposite.

```challenge
title: Lab — the player who ignores you
task: The keys are being read and the player still will not move. Follow the value from the key all the way to the sprite.
hint: '`wantsRight` gets set correctly. Now look for the line that should use it to change the player''s position — is there one?'
solution: |
  // The goal: hold "right" for 30 frames and get the player across to x = 250.
  let playerX = 20, frames = 0;
  const speed = 4;
  function readKeys() { return { right: true }; }   // pretend the key is held
  function step() {
    frames = frames + 1;
    const keys = readKeys();
    const wantsRight = keys.right;
    if (wantsRight) playerX = playerX + speed;      // the value actually gets used
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(playerX, 90, 20, 20);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("holding right: " + wantsRight, 10, 20);
    ctx.fillText("x = " + playerX.toFixed(0), 10, 40);
    if (playerX >= 250) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Moved!", 10, 170); win(); return; }
    if (frames < 200) requestAnimationFrame(step);
  }
  step();
code: |
  // The goal: hold "right" for 30 frames and get the player across to x = 250.
  let playerX = 20, frames = 0;
  const speed = 4;
  function readKeys() { return { right: true }; }   // pretend the key is held
  function step() {
    frames = frames + 1;
    const keys = readKeys();
    const wantsRight = keys.right;
    // the key is read... and then nothing happens with it
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(playerX, 90, 20, 20);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("holding right: " + wantsRight, 10, 20);
    ctx.fillText("x = " + playerX.toFixed(0), 10, 40);
    if (playerX >= 250) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Moved!", 10, 170); win(); return; }
    if (frames < 200) requestAnimationFrame(step);
  }
  step();
```

This is worth remembering as a debugging move in its own right: when something doesn't happen,
**follow the value**. The key was read correctly. The reading just never reached the thing that
moves.

```quiz
question: Your player sticks to the coins instead of collecting them. What did you use?
options:
  - collider, where you wanted overlap
  - overlap, where you wanted collider
  - The wrong sprite
  - No physics at all
answer: 0
feedback:
  - Right — collider pushes things apart, so the player bumps into the coin like a wall.
  - Overlap would let them pass through, which is what you actually want.
  - The sprite would look wrong, not behave wrong.
  - With no physics nothing would be noticed at all.
explain: collider pushes things apart; overlap lets them pass through. Coins want overlap.
```

```yourturn
title: Add a second way to control your game
task: Give your player one more input — a second key, or the mouse.
steps:
  - Open the Code tab and open player.js.
  - Find where the arrow keys are read.
  - Add another key with `this.input.keyboard.addKey("SPACE")` in create(), or use A and D alongside the arrows.
  - Make it do something in update() — a dash, a second jump, dropping something.
  - Ask yourself whether it wants `isDown` or `JustDown`, then press Run and check it behaves.
reward: Controls Engineer badge
check:
  # NOT `called_in_update: movePlayer` — the starter already does that, so the rule would pass
  # before the student touched anything. A rule that is already true is worse than no rule: it
  # awards the badge while looking rigorous.
  # So: prove they changed something, prove they did not break movement while doing it, and leave
  # "is that actually a second control?" to the grader, which is a judgement.
  - changed_at_least: 2
    hint: Nothing in your game has changed yet. Open player.js and add a key.
  - function_kept: movePlayer
    hint: "`movePlayer` has gone from your game — put it back before adding to it."
  - parses: true
    hint: Something in your game no longer parses. Check the console before trying again.
```

## Recap

- **Input, movement, collision** — nearly every game is these three arranged differently.
- Read keys in `update()`. **`isDown`** for held (walking), **`JustDown`** for one press (jumping).
- Move with **velocity**, not by setting position — setting position skips physics and walls.
- **overlap** lets things pass through; **collider** pushes them apart. Coins overlap, floors collide.
- When something does not happen, **follow the value** from where it starts to where it should end up.
