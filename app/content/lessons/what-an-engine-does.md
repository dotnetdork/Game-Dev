---
title: What an Engine Does
xp: 200
ai: full
summary: The loop underneath every game you have ever played.
---

Load up Minecraft. Stand still. Put the controller down and do nothing at all.

The game keeps going without you. Mobs walk. Water flows. The sun moves. Your hunger bar ticks
down. A creeper is heading your way right now. You are doing nothing, and the game is doing
everything.

It does that about **sixty times every second**, and it never stops until you quit. That is the
**game loop** — the same three jobs, over and over. It is the most important idea in this course.

## Read, update, draw

The loop is only three steps, and every game does them in this order:

<figure class="diagram narrow">
  <img src="/content/images/game-loop.svg" alt="The game loop drawn as a vertical cycle. Step 1, read: which buttons are being held down. Step 2, update: move everything, work out what hit what, add up the score. Step 3, draw: put the picture on the screen, then throw the picture away. A dashed arrow runs back up to the start.">
  <figcaption>The green dot is one trip round. The dashed arrow climbing back up the side is the
  important bit — it returns to the start, so the whole thing happens again.</figcaption>
</figure>

One trip around that loop is a **frame**. At sixty a second, each one is over almost instantly.

How fast? Try it.

```run
// @goal: See how little time one frame actually gets. Drag the frame rate.
// @slider: fps 1 120 1 60
// @demo: frames
const msPerFrame = 1000 / fps;

console.log(fps + " frames a second");
console.log("each frame gets " + msPerFrame.toFixed(1) + " milliseconds");
```

At 60 frames a second, one frame gets about **16 milliseconds**. A blink takes 100. So six frames
go past every time you blink. Fortnite, Roblox and Mario all fit their whole game into that.

Why sixty? Because that is about where your eyes stop seeing separate pictures and start seeing
movement. Films use 24. Most games use 60.

Now drag the slider down to 10. Each frame gets 100 milliseconds — as long as a blink. The game
still works. It just feels awful, because it only checks your buttons ten times a second instead of
sixty.

**That is lag.** Nothing is broken. The loop is running late.

> Nothing in a game really moves. It just gets drawn in a slightly different spot every frame.
> Your brain does the rest.

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
  - Drawing happens last, using decisions that were already made.
  - The start is where the world gets built once — input is checked every single frame.
  - Nothing happens between frames. The loop is the whole game.
explain: Read, update, draw — every frame, in that order. Input is read at the top of each frame.
```

Here is the part nobody tells you: a loop does not keep itself going. At the end of every frame,
something has to *ask for the next one*.

In JavaScript that ask has a name — `requestAnimationFrame`. You hand it the name of your function,
and the browser calls that function again just before it next draws the screen:

```
function frame() {
  // read the buttons, move everything, draw it
  requestAnimationFrame(frame);   // ...then ask for the next frame
}

frame();                          // and this starts it off
```

That one line near the bottom is doing all the looping. Everything above it runs perfectly well
without it — exactly once. Then the game sits there forever with no crash and no error message,
looking precisely like a game that is paused.

```challenge
title: Lab — the world that will not tick
task: Find the line that asks for the next frame, and put it back.
goal: The box travels all the way across and the frame counter keeps climbing.
hint: Look at the very end of `frame()`. A loop keeps going because something asks for the next frame. What is missing?
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

That one line is the whole difference between a picture and a game. A picture gets drawn once. A
game gets drawn, then asks to be drawn again, and keeps asking until you close it. Everything else
you build this year sits inside that.

## Same job, different clothes

A game from today and a game from 1985 do the same three steps: read, update, draw.

The new one is not doing anything cleverer. Step 2 — update — just has more stuff to move.

<figure class="shot">
  <img src="/content/images/shots/minecraft-nether.jpg" alt="A Minecraft player looking across a Nether landscape of red rock, lava falls and glowing fire">
  <figcaption>A world this big does not need a cleverer loop. It just gives step 2 more to do.
  <cite><b>Minecraft</b> — Xbox México, CC BY 3.0.</cite></figcaption>
</figure>

<figure class="shot aside pixel">
  <img src="/content/images/shots/fido2-gameplay.png" alt="Fido 2, a very simple 1980s game with blocky low-resolution graphics on a black background">
  <figcaption>1985. A few kilobytes. Read, update, draw.
  <cite><b>Fido 2</b> (1985) — Firebird Software, S. Wilson and J. D. Woodcock. Public domain.</cite></figcaption>
</figure>

This one ran on a computer with less memory than one screenshot on this page. It still read the
buttons, still updated its world, still drew the picture. There was no engine to do any of it —
somebody wrote that loop by hand, in a language much closer to the machine than yours, counting
bytes the whole way. Nobody chose the three steps because they were elegant; they were the only way
to make anything move at all.

The loop has not changed in forty years. Only the game inside it has. That is good news for you:
learn it once, and you know how every game works, from this one to whatever came out last week.

## So what is the engine for?

A **game engine** is software that does the boring parts for you — the parts that are the same in
every game ever made, like the loop, the drawing and the file loading. You could write all of that
yourself. People used to. It took years.

| The engine does this for you | So you don't have to |
|---|---|
| Runs the loop | Write your own timing code |
| Draws pictures on screen | Talk to the graphics card |
| Works out when things touch | Do the maths of two boxes overlapping |
| Loads images and sounds | Handle a dozen file formats |
| Reads the buttons | Support every keyboard and controller ever made |

What is left is your actual game: what things are, what the rules are, and whether it is any fun.
No engine does that part for you.

```quiz
question: Which of these is NOT something a game engine normally does for you?
options:
  - Decide what makes your game fun
  - Draw pictures on the screen
  - Work out when two things collide
  - Run the loop 60 times a second
answer: 0
feedback:
  - Right. The engine handles the machinery. The game design is entirely yours.
  - Drawing is one of the main things it handles.
  - Collision maths is standard engine work.
  - The loop is the engine's core job.
explain: An engine gives you the machinery. What the game IS — the rules, the feel, the fun — is the part you bring.
```

You will hear four engine names over and over:

- **Unity** and **Unreal** — huge, and built for 3D. Most big games use one of these.
- **Godot** — smaller, free, popular with small teams.
- **Phaser** — yours. It makes 2D games that run in a web browser, so anyone can play your game
  without installing anything.

They look different. Underneath, all four are the same machine: a thing that runs the loop, a thing
that draws, a thing that handles collisions, a thing that loads files, and a thing that reads the
buttons.

```yourturn
title: Find the loop in your own game
task: Your game has this exact loop inside it right now. Go and find it, and prove to yourself it is really running.
steps:
  - Open `game.js` in the Code tab.
  - Find the function called `update` — that is step 2, and Phaser calls it every frame.
  - Add `console.log("frame")` as its first line.
  - Press Run, open the Play tab, and watch the console. That blur is the loop.
  - Delete the line again, or the console stays unusable.
reward: Engine Room badge
```

## Recap

- Every game runs a **loop**: read the buttons, update the world, draw it.
- One trip around the loop is a **frame**, and there are about 60 of them every second.
- That gives each frame about **16 milliseconds** to do all three steps.
- **Lag** is the loop running late. The game is not broken.
- A **game engine** does the loop, the drawing, the collisions, the file loading and the buttons.
- The rules and the fun are yours. That part is the actual game.
