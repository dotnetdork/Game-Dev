---
title: What an Engine Does
xp: 200
ai: full
summary: The loop underneath every game you have ever played.
---

Load up Minecraft. Stand still. Put the controller down and do nothing at all. The game keeps
going without you. Mobs walk. Water flows. The sun moves. A creeper is heading your way right now.
You are doing nothing, and the game is doing everything.

It does that about **sixty times every second**, and it never stops until you quit. That is the
**game loop**, and it is the most important idea in this course.

## Read, update, draw

<figure class="diagram narrow">
  <img src="/content/images/game-loop.svg" alt="The game loop drawn as a vertical cycle. Step 1, read: which buttons are being held down. Step 2, update: move everything, work out what hit what, add up the score. Step 3, draw: put the picture on the screen, then throw the picture away. A dashed arrow runs back up to the start.">
  <figcaption>One trip round is a <b>frame</b>. The dashed arrow climbing back up the side is the
  important bit — it returns to the start, so the whole thing happens again.</figcaption>
</figure>

```run
// @goal: Drag the frame rate down and watch the box fall behind the ghost.
// @slider: fps 1 120 1 60
// @demo: frames
console.log(fps + " frames a second, so each frame gets " + (1000 / fps).toFixed(1) + " milliseconds");
```

That line of code is `console.log`, and it does exactly one thing: it prints. Whenever you see it
in this course, it means *show me this*. Your own game has a console too — the panel under the
Code and Game tabs — and it is where your game talks to you.

At 60 frames a second each frame gets about **16 milliseconds**. A blink takes 100. Drag the slider
down to 10 and the box lurches along behind the ghost it can never catch. Nothing is broken. The
loop is running late. **That is lag.**

> Nothing in a game really moves. It gets drawn in a slightly different spot every frame, and your
> brain does the rest.

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

A picture gets drawn once. A game gets drawn, then asks to be drawn again, and keeps asking until
you close it. Everything you build this year sits inside that.

<figure class="shot">
  <img src="/content/images/shots/minecraft-nether.jpg" alt="A Minecraft player looking across a Nether landscape of red rock, lava falls and glowing fire">
  <figcaption>A world this big does not need a cleverer loop. It just gives step 2 more to do.
  <cite><b>Minecraft</b> — Xbox México, CC BY 3.0.</cite></figcaption>
</figure>

## So what is the engine for?

A **game engine** is software that does the parts that are the same in every game ever made, so
you can spend your time on the part that is yours.

| The engine does this for you | So you don't have to |
|---|---|
| Runs the loop | Write your own timing code |
| Draws pictures on screen | Talk to the graphics card |
| Works out when things touch | Do the maths of two boxes overlapping |
| Loads images and sounds | Handle a dozen file formats |
| Reads the buttons | Support every keyboard and controller ever made |

What is left is the actual game: what things are, what the rules are, and whether it is any fun.
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

You will hear four engine names over and over. **Unity** and **Unreal** are huge, and built for 3D.
**Godot** is smaller and free. **Phaser** is yours: it makes 2D games that run in a web browser, so
when your game is finished it is a *link*. No install, no download. Anyone you send it to is
playing two seconds later.

Underneath, all four are the same machine — and the one running your game right now is yours to
change from this very first lesson. So change it.

```yourturn
title: Make it move at your speed
task: Your game has a file full of numbers, and one of them is how fast the player walks. Pick a speed you like and keep it.
steps:
  - Open the **Code** tab. Down the left is your game, split into files. Click `config.js`.
  - 'Find `moveSpeed: 110`. Change 110 to 250 — a big jump, so you can feel it.'
  - Open the **Game** tab and press **Play**. Walk with the arrow keys or WASD.
  - Now pick the speed that feels right to *you* — fast, slow, silly — and leave it there. It is your game now.
check:
  - config_changed: moveSpeed
    hint: "`moveSpeed` in config.js is still 110 — change the number, then press Play to feel it."
reward: Engine Room badge
```

## Recap

- Every game runs a **loop**: read the buttons, update the world, draw it.
- One trip round is a **frame**; there are about 60 a second, and each gets about **16 ms**.
- **Lag** is the loop running late. The game is not broken.
- `console.log` prints. The console is where your game talks to you.
- A **game engine** does the loop, the drawing, the collisions, the files and the buttons.
- The rules and the fun are yours. That part is the actual game.
