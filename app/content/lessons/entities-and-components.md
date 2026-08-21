---
title: Entities and Components
xp: 220
ai: full
summary: Why a coin, a bullet and an enemy are the same thing wearing different hats.
---

You could write separate code for coins, separate code for bullets, and separate code for enemies.

Every large game stopped doing that a long time ago, and the reason is worth understanding — it's
one of those ideas that changes how you see all the code you write afterwards.

## The same thing, different parts

Look at what a coin, a bullet and an enemy actually *are*:

| | Coin | Bullet | Enemy |
|---|---|---|---|
| Has a position | yes | yes | yes |
| Has a picture | yes | yes | yes |
| Moves | no | yes | yes |
| Can be collected | yes | no | no |
| Can damage you | no | yes | yes |
| Has health | no | no | yes |

They aren't three different things. They're one thing — something in the world — with a **different
set of parts**.

That's the whole idea:

- An **entity** is a thing in your game. It's barely anything on its own.
- A **component** is one capability it has: a position, a picture, health, damage.
- A thing *is* the parts it has.

## What they all share

<figure class="art">
  <div class="art-row">
    <span class="art-cell"><img src="/assets/bee.png" alt="A bee enemy"><b>bee</b></span>
    <span class="art-cell"><img src="/assets/slimeGreen.png" alt="A green slime enemy"><b>slimeGreen</b></span>
    <span class="art-cell"><img src="/assets/ghost.png" alt="A ghost enemy"><b>ghost</b></span>
    <span class="art-cell"><img src="/assets/snail.png" alt="A snail enemy"><b>snail</b></span>
    <span class="art-cell"><img src="/assets/fishGreen.png" alt="A green fish enemy"><b>fishGreen</b></span>
    <span class="art-note">Five enemies. Not five kinds of code — one kind, wearing five
    pictures.</span>
  </div>
  <figcaption>Every one of these has a position, a picture, a speed and a way to be hit. That is
  four components. The bee flies, the snail crawls and the ghost passes through walls, so each one
  <em>also</em> has something the others don't — but the shared four are why adding a sixth enemy is
  an afternoon rather than a rewrite.
  <cite><b>Kenney</b> — Platformer Pack, public domain (CC0).</cite></figcaption>
</figure>

Almost everything in your game needs the same small handful:

- **Position** — where it is.
- **Sprite** — what it looks like.
- **Body** — a box for collisions.

If you find yourself writing "x and y and a picture" for the fourth time, that's the signal. Those
three belong in one place, and everything else builds on top.

```quiz
question: In this way of thinking, what actually makes an enemy different from a coin?
options:
  - The set of parts it has — an enemy has health and does damage
  - Enemies are a completely different kind of object
  - Enemies are drawn with different code
  - Nothing; they are identical
answer: 0
feedback:
  - Right. Same foundation, different parts bolted on.
  - That is the approach this replaces — and it means writing everything twice.
  - Both get drawn by the same code, using different pictures.
  - They differ, just not in the way beginners usually assume.
explain: An entity is defined by the components it has. Add health and damage to a coin and you have an enemy.
```

## What makes each one different

<figure class="shot">
  <img src="/content/images/shots/supertuxkart-select.jpg" alt="The SuperTuxKart character selection screen: a grid of different drivers to choose from">
  <figcaption>Every kart on this screen runs the same code. What differs is a handful of numbers —
  speed, weight, grip — and a picture. That is components, in a screen a player actually sees:
  choosing a character is choosing a set of values, not a set of behaviour.
  <cite><b>SuperTuxKart</b> — SuperTuxKart team, screenshot by QwertyChouskie, CC BY-SA
  4.0.</cite></figcaption>
</figure>

Once the shared foundation exists, each kind is a short list of extras:

```
coin   = position + sprite + collectable
bullet = position + sprite + movement + damage
enemy  = position + sprite + movement + damage + health
```

Read that list and you can predict exactly how each behaves without reading any code. That's the
sign you've got the shape right.

It also makes bugs less scary. If collision is broken for everything, the shared part is wrong. If
it's broken for enemies only, it's in the enemy's extras. The bug has a smaller place to hide.

## Adding a new kind for free

Here's where it pays off. Somebody asks for a new enemy that shoots.

The old way: copy the enemy file, paste it, change bits, and now you have two files that both need
fixing every time you find a bug.

This way: `shooter = position + sprite + movement + damage + health + shooting`. You add one new
part and combine it with what already exists. Nothing gets copied, so nothing can drift out of
step.

> The test of a good structure isn't how neat it looks. It's how much you have to write to add the
> next thing.

```challenge
title: Lab — four things, four copies of the same code
task: The same lines appear four times with tiny differences. Find what they share and make one version that handles all of them.
hint: Every one of them needs its x moved by its speed. Instead of four separate blocks, could you keep them in a list and go through it?
solution: |
  // The goal: move everything with ONE piece of movement code, not four copies.
  const things = [
    { name: "coin",   x: 10, speed: 0 },
    { name: "bullet", x: 10, speed: 6 },
    { name: "enemy",  x: 10, speed: 2 },
    { name: "cloud",  x: 10, speed: 1 }
  ];
  let moveBlocks = 1;                  // one loop handles every kind
  for (let i = 0; i < 12; i++) {
    things.forEach(function (t) { t.x = t.x + t.speed; });
  }
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
  things.forEach(function (t, i) { ctx.fillText(t.name + " x=" + t.x, 10, 30 + i * 20); });
  ctx.fillText("movement written " + moveBlocks + " time(s)", 10, 130);
  if (moveBlocks === 1) { ctx.fillStyle = "#3ddc84"; ctx.fillText("One rule, four things.", 10, 160); win(); }
  else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Still copied " + moveBlocks + " times.", 10, 160); }
code: |
  // The goal: move everything with ONE piece of movement code, not four copies.
  const coin   = { name: "coin",   x: 10, speed: 0 };
  const bullet = { name: "bullet", x: 10, speed: 6 };
  const enemy  = { name: "enemy",  x: 10, speed: 2 };
  const cloud  = { name: "cloud",  x: 10, speed: 1 };
  const things = [coin, bullet, enemy, cloud];
  let moveBlocks = 4;                  // the same three words, written out four times
  for (let i = 0; i < 12; i++) {
    coin.x = coin.x + coin.speed;
    bullet.x = bullet.x + bullet.speed;
    enemy.x = enemy.x + enemy.speed;
    cloud.x = cloud.x + cloud.speed;
  }
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
  things.forEach(function (t, i) { ctx.fillText(t.name + " x=" + t.x, 10, 30 + i * 20); });
  ctx.fillText("movement written " + moveBlocks + " time(s)", 10, 130);
  if (moveBlocks === 1) { ctx.fillStyle = "#3ddc84"; ctx.fillText("One rule, four things.", 10, 160); win(); }
  else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Still copied " + moveBlocks + " times.", 10, 160); }
```

Both versions produce identical results. The difference is what happens when you want to add a
fifth thing, or fix how movement works — one version needs a single change, the other needs five.

```quiz
question: What is the real advantage of building things out of shared parts?
options:
  - Adding a new kind means combining existing parts instead of copying a file
  - It makes the game run faster
  - It uses fewer variables
  - It is the only way Phaser works
answer: 0
feedback:
  - Right. The measure of a good structure is how little you write to add the next thing.
  - Speed is roughly the same.
  - Variable count is not what this is about.
  - Phaser is happy either way; this is about keeping your own code sane.
explain: Copying a file means every future fix has to be made in several places. Shared parts mean one fix, everywhere.
```

```yourturn
title: Find the copy-paste in your own game
task: Look for code you have written more than once, and pull the shared part out.
steps:
  - Open the Code tab and read through your files looking for two blocks that look almost the same.
  - Work out what they share and what genuinely differs — the difference is usually just a number or a name.
  - Write one version that takes the difference as a value, and use it in both places.
  - Press Run and check the game behaves exactly as before. Same game, half the code.
reward: Systems Thinker badge
```

## Recap

- An **entity** is a thing in the world; a **component** is one capability it has.
- A coin, a bullet and an enemy differ by their **parts**, not their type.
- Nearly everything shares **position**, **sprite** and **body**.
- Writing the same lines a fourth time is the signal to pull them out.
- The measure of a good structure is **how little you write to add the next thing**.
