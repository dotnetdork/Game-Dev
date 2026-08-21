---
title: What an Engine Does
xp: 200
ai: full
summary: The loop underneath every game you have ever played.
---

Every game you have played — Minecraft, Fortnite, Mario — is doing the same three things about
sixty times a second. Once you have seen it, you cannot unsee it.

A **game engine** is the software that does those three things for you, so you can spend your time
on the parts that make your game *yours*.

## The loop: read, update, draw

Here it is, the whole thing:

1. **Read** — what is the player pressing right now?
2. **Update** — move everything, check what hit what, add up the score.
3. **Draw** — put the result on screen.

Then throw that picture away and do it again. And again. Sixty times a second, for as long as the
game is open.

<figure class="diagram">
  <img src="/content/images/game-loop.svg" alt="Three steps in a cycle — read the input, update the world, draw it — with an arrow going back from draw to read.">
  <figcaption>The green dot is one <b>frame</b> going round. The dashed arrow back to the start is the whole trick: nothing would move without it.</figcaption>
</figure>

That's it. Minecraft is doing that. Fortnite is doing that. The game you are about to build is
doing that.

## Sixty times a second

Why sixty? Because that's roughly when your eyes stop seeing separate pictures and start seeing
movement. Films do 24. Most games aim for 60.

Each trip round the loop is a **frame**. When people say a game "runs at 60 FPS", they mean it gets
all the way round sixty times a second.

This is also why "lag" feels so bad. A slow frame means the game read your button press late, and
the whole thing stops feeling connected to your hands.

> Nothing in a game moves. Things are *drawn in a slightly different place* sixty times a second,
> and your brain does the rest.

```quiz
question: Your game runs the loop 60 times a second. Where does "the player pressed jump" get noticed?
options:
  - In the read step, at the start of a frame
  - In the draw step
  - Only when the game first starts
  - Between frames, at random
answer: 0
feedback:
  - Right. Every frame begins by asking what the controls are doing.
  - Drawing happens last, using decisions already made.
  - The start is where the world gets built once — input is checked every frame.
  - Nothing happens between frames; the loop is the whole game.
explain: Read, update, draw — every frame, in that order. Input is read at the top of each frame.
```

## What the engine does for you

You could write all of this yourself. People did, once, and it took years. An engine hands you:

| The engine gives you | So you don't have to |
|---|---|
| The loop itself | Write your own timing code |
| Drawing pictures on screen | Talk to the graphics card |
| Physics and collision | Work out the maths of two boxes touching |
| Loading images and sounds | Handle a dozen file formats |
| Input | Deal with every keyboard and controller ever made |

What's left is the game: what things are, what the rules are, what happens when they meet. That
part is yours.

## Same job, different clothes

<figure class="shot">
  <img src="/content/images/shots/halo4-multiplayer.jpg" alt="A Halo 4 multiplayer match seen from the player's view, with a heads-up display showing shields, ammunition and a motion tracker">
  <figcaption>This and Pac-Man are the same three steps. Read what the player is doing, work out what
  changed, draw it — sixty times a second. Everything that looks like a difference between these two
  games happens <em>inside</em> the "work out what changed" step. The loop does not get more
  sophisticated; the game inside it does.
  <cite><b>Halo 4</b> — Xbox MENA, CC BY 3.0.</cite></figcaption>
</figure>

<figure class="shot aside">
  <img src="/content/images/shots/fido2-gameplay.png" alt="Fido 2, a very simple 1980s game with blocky low-resolution graphics on a black background">
  <figcaption>1985, a few kilobytes, and the same three steps again. If your engine ever feels like
  magic, remember that this ran on a machine with less memory than one of the screenshots on this
  page. <cite><b>Fido 2</b> (1985) — Firebird Software, S. Wilson and J. D. Woodcock. Public
  domain.</cite></figcaption>
</figure>

Unity, Unreal, Godot and Phaser all do the list above. They look wildly different and they argue
about details, but underneath they are the same machine.

- **Unity** and **Unreal** are 3D-first, huge, used for most big commercial games.
- **Godot** is smaller, free, and increasingly popular with independent developers.
- **Phaser** — the one you're using — is 2D and runs in a browser, which is why your game will work
  on anything with a web browser and no installing.

Learning the loop means learning all of them. The buttons move; the machine doesn't.

```challenge
title: Lab — the world that will not tick
task: Everything is drawn once and then freezes. The loop only runs a single time. Find the reason and get the world moving.
hint: Look at the end of `frame()`. A loop keeps going because something asks for the next frame. What is missing?
solution: |
  // The goal: the box must travel across the screen, which needs the loop to keep going.
  let x = 10, frames = 0;
  function frame() {
    frames = frames + 1;
    x = x + 4;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(x, 90, 20, 20);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("frame " + frames, 10, 20);
    if (x > 250) { ctx.fillText("It lives!", 10, 40); win(); return; }
    requestAnimationFrame(frame);      // ask for the next one — this is the loop
  }
  frame();
code: |
  // The goal: the box must travel across the screen, which needs the loop to keep going.
  let x = 10, frames = 0;
  function frame() {
    frames = frames + 1;
    x = x + 4;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(x, 90, 20, 20);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("frame " + frames, 10, 20);
    if (x > 250) { ctx.fillText("It lives!", 10, 40); win(); return; }
    // nothing asks for another frame, so this happens exactly once
  }
  frame();
```

```quiz
question: Which of these is NOT something a game engine normally does for you?
options:
  - Decide what makes your game fun
  - Draw pictures on the screen
  - Work out when two things collide
  - Run the loop 60 times a second
answer: 0
feedback:
  - Right. The engine handles the machinery; the game design is entirely yours.
  - Drawing is one of the main things it handles.
  - Collision maths is standard engine work.
  - The loop is the engine's core job.
explain: An engine gives you the machinery. What the game IS — the rules, the feel, the fun — is the part you bring.
```

```yourturn
title: Find the loop in your own game
task: Your game has this exact loop in it. Go and find it, and prove to yourself it is running.
steps:
  - Open the Code tab and open game.js.
  - Find the function called `update`. That is the "update" step of the loop, and Phaser calls it every frame.
  - Add `console.log("frame")` as the first line inside it.
  - Press Run, then open the Play tab and look at the console underneath. Watch how fast it fills up — that is 60 frames a second.
  - Delete the line again once you have seen it, or your console will be unusable.
reward: Engine Room badge
```

## Recap

- Every game runs a **loop**: read the input, update the world, draw it. About 60 times a second.
- One trip round is a **frame**.
- The **engine** gives you the loop, the drawing, the physics, the loading and the input.
- What's left — the rules and the feel — is your game.
- Unity, Unreal, Godot and Phaser are the same machine wearing different clothes.
