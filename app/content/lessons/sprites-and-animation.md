---
title: Sprites and Animation
xp: 200
ai: full
summary: How a picture becomes a character that moves.
---

Mario is not walking.

Mario is four pictures, shown one after another, faster than you can notice. Your brain does the
rest — the same trick that makes a flipbook work, and the same trick films have used for a hundred
years.

## A sprite is just a picture

A **sprite** is an image you can move around the screen. That's the whole definition.

It has a position, it has a size, and you can draw it anywhere. Everything else — walking,
jumping, exploding — is you swapping *which* picture is shown, or *where*.

```run
// @goal: Flip through a walk cycle by hand. Change how many frames it has.
// @slider: frames 2 8 1 4
let strip = "";
for (let f = 0; f < frames; f++) strip = strip + "[" + f + "] ";
console.log("the walk cycle:  " + strip);
console.log("shown in order, then straight back to [0] — forever");
console.log(frames + " still pictures. Not one of them moves.");
```

## Frames in a row

An animation is a list of pictures and an order to show them in.

Walking might be four **frames**: left foot forward, passing, right foot forward, passing. Show
them in a loop and it walks. Show them backwards and it moonwalks.

```run
// @goal: Pick which frames off the sheet belong to this animation.
// @slider: end 1 7 1 3
const sheet = [0, 1, 2, 3, 4, 5, 6, 7];
const used = sheet.slice(0, end + 1);
console.log("the sheet holds frames " + sheet.join(", "));
console.log("start: 0, end: " + end + "   ->   plays " + used.join(", "));
console.log("that is a " + used.length + "-frame cycle");
```

In Phaser you describe it once in `create()`:

```
this.anims.create({
  key: "walk",
  frames: this.anims.generateFrameNumbers("player", { start: 0, end: 3 }),
  frameRate: 10,
  repeat: -1
});
```

Then in `update()` you just say `player.anims.play("walk", true)`. The engine handles the swapping.

`repeat: -1` means forever — that's for walking. For a one-off like an explosion, leave it out so
it plays once and stops.

```quiz
question: What is an animation, underneath?
options:
  - A list of pictures shown one after another in order
  - A single picture that moves itself
  - A special kind of physics
  - A video file
answer: 0
feedback:
  - Right — a flipbook. Your brain turns the sequence into movement.
  - A picture that moves is just a sprite changing position, which is different.
  - Physics moves things; animation changes what they look like.
  - Video is far too heavy, and you could not control it frame by frame.
explain: An animation is a list of frames and a speed. The engine swaps which one is drawn.
```

<figure class="diagram">
  <img src="/content/images/sprite-sheet.svg" alt="One image file divided into six numbered cells, each holding a frame of a walking character. Below it, a single panel showing those frames playing one after another.">
  <figcaption>One file, six frames, swapped on a timer. Nothing walks — you are looking at still pictures being replaced, which is the same trick as the game loop one module ago.</figcaption>
</figure>

## Speed changes everything

<figure class="shot">
  <img src="/content/images/shots/flinthook-level.jpg" alt="A Flinthook level: a small hooded character swinging through a spaceship interior full of platforms, chains and enemies">
  <figcaption>A modern 2D game where the animation <em>is</em> the selling point. Every enemy, every
  chain, every flicker of the character's cape is a handful of frames on a sheet, cycling at a speed
  somebody chose by eye. Nothing here is 3D and nothing here is expensive — it is frame counts and
  timing, which is exactly what you are about to change in your own game.
  <cite><b>Flinthook</b> — Tribute Games, CC BY-SA 3.0.</cite></figcaption>
</figure>

`frameRate` is how many pictures per second, and it does more work than you'd expect.

The same four walking frames at different speeds give you completely different characters:

| Frame rate | Feels like |
|---|---|
| 4 | Heavy, plodding, tired |
| 10 | Normal walking |
| 20 | Frantic, comic, panicked |

You'll tune this by feel, not by calculation. Set it, watch it, change it. That's the whole method.

One rule worth knowing: **the animation should match the movement speed.** A character sprinting
across the screen while their legs amble looks wrong even if you can't say why — it's called
"skating", and once you've noticed it you'll see it in games everywhere.

```run
// @goal: Match the legs to the speed. Find where it stops looking like skating.
// @slider: moveSpeed 40 400 20 200
const strideLength = 40;                                 // pixels covered by one step
const cyclesPerSecond = moveSpeed / (strideLength * 2);  // a walk cycle is two steps
const frameRate = Math.round(cyclesPerSecond * 4);       // four frames in that cycle
console.log("moving at " + moveSpeed + " pixels per second");
console.log("that is " + cyclesPerSecond.toFixed(1) + " walk cycles a second");
console.log("so a 4-frame cycle needs about " + frameRate + " fps to keep up");
console.log(frameRate <= 6 ? "reads as: heavy, plodding, tired"
  : frameRate >= 18 ? "reads as: frantic, comic, panicked"
  : "reads as: normal walking");
```

## Facing the right way

You almost never draw a character twice. You draw them facing right, and flip the picture when they
walk left:

```
player.setFlipX(true);   // now facing left
```

That halves your artwork, and it's what nearly every 2D game does. It's also why some old game
characters carry their sword in whichever hand you're not looking at.

The rule that follows: **draw everything facing the same direction.** If half your art faces left
and half faces right, you'll spend forever tracking down which ones need flipping.

```challenge
title: Lab — the animation that will not play
task: The frames are loaded and the animation never runs. Find the step between having frames and actually showing them.
hint: Creating an animation only describes it. Something has to ask for it to start. Is anything calling `play`?
solution: |
  // The goal: reach frame 4 of the walk cycle. Describing an animation is not the same as playing it.
  const anims = {};
  let currentFrame = 0, playing = false, ticks = 0;
  function createAnim(key, frames, rate) { anims[key] = { frames: frames, rate: rate }; }
  function play(key) { if (anims[key]) playing = true; }
  createAnim("walk", [0, 1, 2, 3], 10);
  play("walk");                      // ask for it to actually start
  function step() {
    ticks = ticks + 1;
    if (playing) currentFrame = currentFrame + 1;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("animation described: " + (anims.walk ? "yes" : "no"), 10, 30);
    ctx.fillText("playing: " + playing, 10, 52);
    ctx.fillText("frame: " + currentFrame, 10, 74);
    if (currentFrame >= 4) { ctx.fillStyle = "#3ddc84"; ctx.fillText("It walks.", 10, 110); win(); return; }
    if (ticks < 40) requestAnimationFrame(step);
    else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Described, but never played.", 10, 110); }
  }
  step();
code: |
  // The goal: reach frame 4 of the walk cycle. Describing an animation is not the same as playing it.
  const anims = {};
  let currentFrame = 0, playing = false, ticks = 0;
  function createAnim(key, frames, rate) { anims[key] = { frames: frames, rate: rate }; }
  function play(key) { if (anims[key]) playing = true; }
  createAnim("walk", [0, 1, 2, 3], 10);
  // the animation exists. nothing ever asks for it.
  function step() {
    ticks = ticks + 1;
    if (playing) currentFrame = currentFrame + 1;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("animation described: " + (anims.walk ? "yes" : "no"), 10, 30);
    ctx.fillText("playing: " + playing, 10, 52);
    ctx.fillText("frame: " + currentFrame, 10, 74);
    if (currentFrame >= 4) { ctx.fillStyle = "#3ddc84"; ctx.fillText("It walks.", 10, 110); win(); return; }
    if (ticks < 40) requestAnimationFrame(step);
    else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Described, but never played.", 10, 110); }
  }
  step();
```

"Described but never played" is a whole family of bugs, not just an animation one. Setting something
up and never triggering it looks completely correct when you read the code — which is exactly why it
takes so long to spot.

```quiz
question: Your character sprints across the screen while their legs amble slowly. What is wrong?
options:
  - The frame rate does not match how fast they are moving
  - The sprite is too small
  - Gravity is too low
  - The animation has too many frames
answer: 0
feedback:
  - Right — that mismatch is called skating, and you will now see it everywhere.
  - Size would not cause it.
  - Gravity affects falling, not the walk cycle.
  - Any number of frames works if the rate matches the movement.
explain: Animation speed should match movement speed. When they disagree, the character looks like it is sliding.
```

```yourturn
title: Animate something in your own game
task: Give one thing in your game more than one frame.
steps:
  - Open the Store and find a character with several poses — the alien sprites have walk, jump and duck versions.
  - Buy or use the free ones, noting each green key exactly.
  - Open the Code tab and open player.js.
  - Swap the picture depending on what the player is doing — one key while moving, another while still.
  - Press Run and move around. Then change how fast it swaps until the movement looks right.
reward: Animator badge
```

## Recap

- A **sprite** is a picture you can move. That's all it is.
- An **animation** is a list of frames shown in order — a flipbook.
- **`frameRate`** changes the character completely. Tune it by watching, not calculating.
- Match animation speed to movement speed, or you get **skating**.
- **Flip** the sprite instead of drawing it twice, and draw all your art facing the same way.
