---
title: Feedback
xp: 200
ai: full
summary: How a game tells you something happened — and why silence feels broken.
---

Try this. Imagine Mario jumping on a Goomba, except: no sound, no squash, no little bounce, no
points popping up. The Goomba just isn't there any more.

Did you win? Probably. Does it feel like anything? Not really.

**Feedback** is everything a game does to tell you that what you did mattered. It is the second
beat of the core loop, and it is the single cheapest way to make a game feel good.

## Games are talking to you constantly

Once you start noticing, you can't stop:

- Fortnite's hit marker — a tiny cross that appears when your shot lands.
- Minecraft's block-break — cracks appear, then a *pop* and a floating item.
- Mario's coin *ping* and the little "+100" that drifts upward.

Three completely different games, all doing the same job: **you did a thing, here is proof.**

## Four ways to say "that worked"

You have four channels, and the good ones use several at once:

| Channel | Example |
|---|---|
| **See** | A flash, a number popping up, a health bar shrinking |
| **Hear** | A click, a ping, a crunch |
| **Move** | A screen shake, a recoil, a little bounce |
| **Change** | The score goes up, the door opens, the enemy is gone |

Only the last one actually changes the game. The other three are pure communication — and they're
the ones that make it *feel* like something happened.

> A hit that changes a number and nothing else is a spreadsheet. A hit that flashes, clicks and
> shakes is a game.

```quiz
question: A player shoots an enemy. The enemy's health drops from 50 to 40, and nothing else on screen changes at all. What's missing?
options:
  - Feedback — nothing tells the player the shot landed
  - The core loop
  - Physics
  - Nothing, the health went down so it works
answer: 0
feedback:
  - Right. Something changed, but the game never told the player, so it feels broken.
  - The loop is fine here — they shoot, and can shoot again.
  - Physics is about movement and collision, not about telling the player things.
  - It works, but working and feeling like it works are different problems.
explain: Changing a value is not the same as communicating it. Without a flash, sound or number, the player can't tell their shot did anything.
```

## Fast beats fancy

The most important thing about feedback is not how impressive it is. It's **how quickly it
arrives**.

Your brain links an action to its result inside about a tenth of a second. Past that, the two stop
feeling connected. This is why a small instant flash beats a gorgeous explosion that starts half a
second late — and why laggy games feel awful even when nothing is technically wrong.

So the rule is: **the moment the thing happens, say so.** Even if all you can manage is one frame
of white.

## The other job: telling people they failed

Feedback isn't only for success. When a player does something that *doesn't* work, the game has to
say so — otherwise they can't learn.

Watch someone play a platformer and miss a jump. A good game makes the failure completely obvious:
a sound, a fall, a respawn. A bad one just... puts them somewhere else, and they never work out
what they did wrong.

Here's a hit that changes a number and says nothing.

```challenge
title: Lab — the silent hit
task: Hitting the target lowers its health, but nothing tells the player. Add feedback so a hit is obvious — a flash, a number, a shake, anything.
symptoms:
  - The hit works, but nothing on screen shows it happened
  - The target's health never actually goes down
  - The player can't reach the target
answer: 0
hint: Look at `hit()`. It changes `health` and stops. Try setting `flash = 6` in there, and draw something different while `flash` is above 0.
solution: |
  // Checked, not taken on trust: on the frame of a hit, the way the target is DRAWN must change.
  // Feedback the player cannot see is not feedback.
  let health = 30, flash = 0, lastLook = "", lookAtHit = "", proved = false, hitFrame = -9;
  function hit() {
    health = health - 10;
    flash = 6;                       // tell the player, right now
  }
  function draw() {
    ctx.clearRect(0, 0, 300, 200);
    drawnColour = flash > 0 ? "#ffffff" : "#d64545";
    drawnSize = flash > 0 ? 64 : 56;
    ctx.fillStyle = drawnColour;
    ctx.fillRect(150 - drawnSize / 2, 100 - drawnSize / 2, drawnSize, drawnSize);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "14px sans-serif";
    ctx.fillText("Health: " + Math.max(0, health), 10, 20);
    if (flash > 0) { ctx.fillStyle = "#f5b02e"; ctx.fillText("-10", 165, 78); flash = flash - 1; }
  }
  function look() { return drawnColour + "|" + drawnSize; }
  let drawnColour = "", drawnSize = 0;
  let t = 0;
  function step() {
    t = t + 1;
    if (t % 30 === 0 && health > 0) { lookAtHit = look(); hitFrame = t; hit(); }
    draw();
    if (hitFrame > 0 && t === hitFrame + 1) {
      if (look() !== lookAtHit) proved = true;
    }
    if (proved) { ctx.fillStyle = "#3ddc84"; ctx.fillText("The player can SEE the hit", 10, 190); win(); return; }
    if (t < 300 && health > 0) requestAnimationFrame(step);
  }
  step();
code: |
  // Checked, not taken on trust: on the frame of a hit, the way the target is DRAWN must change.
  // Feedback the player cannot see is not feedback.
  let health = 30, flash = 0, lastLook = "", lookAtHit = "", proved = false, hitFrame = -9;
  function hit() {
    health = health - 10;
    // the health changed. the player has no idea.
  }
  function draw() {
    ctx.clearRect(0, 0, 300, 200);
    drawnColour = "#d64545";         // always the same
    drawnSize = 56;                  // always the same
    ctx.fillStyle = drawnColour;
    ctx.fillRect(150 - drawnSize / 2, 100 - drawnSize / 2, drawnSize, drawnSize);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "14px sans-serif";
    ctx.fillText("Health: " + Math.max(0, health), 10, 20);
  }
  function look() { return drawnColour + "|" + drawnSize; }
  let drawnColour = "", drawnSize = 0;
  let t = 0;
  function step() {
    t = t + 1;
    if (t % 30 === 0 && health > 0) { lookAtHit = look(); hitFrame = t; hit(); }
    draw();
    if (hitFrame > 0 && t === hitFrame + 1) {
      if (look() !== lookAtHit) proved = true;
    }
    if (proved) { ctx.fillStyle = "#3ddc84"; ctx.fillText("The player can SEE the hit", 10, 190); win(); return; }
    if (t < 300 && health > 0) requestAnimationFrame(step);
  }
  step();
```

Notice how little it took. A colour change and a number. That's it — and the difference is huge.

```quiz
question: Your explosion effect looks amazing but starts half a second after the hit. What's the problem?
options:
  - Too slow — after about a tenth of a second the player stops linking it to what they did
  - Explosions are always a bad idea
  - It should be louder
  - Nothing, it looks great
answer: 0
feedback:
  - Exactly. Late feedback stops feeling like a response and starts feeling like a coincidence.
  - Explosions are fine. The timing is the issue.
  - Volume won't fix arriving late.
  - Looking great and feeling connected are different things — and the timing breaks the connection.
explain: Feedback has to arrive almost instantly. A plain flash on the same frame beats a beautiful effect that is late.
```

```yourturn
title: Make one thing in your game shout
task: Pick the single most important thing that happens in your game — the collect, the hit, the jump — and give it feedback on at least two channels.
steps:
  - Open the Code tab and find the moment that matters most in your game.
  - Add something you can SEE — the object changing colour for a few frames, or a number appearing.
  - Add a second channel if you can — a size change, a little bounce, or a sound if you own one from the Store.
  - Press Run. Do the thing. If you had to look at the score to know it worked, it isn't loud enough yet.
reward: Game Feel badge
```

## Recap

- **Feedback** is how a game tells the player their action mattered.
- Four channels: **see**, **hear**, **move**, **change**. Only "change" alters the game; the rest
  do the communicating.
- **Speed beats spectacle.** Roughly a tenth of a second, or the link is broken.
- Failure needs feedback just as much as success does.
