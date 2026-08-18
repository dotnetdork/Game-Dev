---
title: What a Game Is Made Of
xp: 200
ai: full
summary: Sprites, sheets, sounds and tilemaps — the pieces behind the picture.
---

Open any game's folder and you'll find thousands of files. Almost none of them are code.

A game is mostly **assets**: pictures, sounds, fonts, maps. The code is the small part that decides
what to do with them. Minecraft is a few hundred textures and a rulebook.

## Sprites and sprite sheets

A **sprite** is a picture you can move around. Your player, a coin, an enemy — all sprites.

Drawing Mario walking takes several pictures shown in order. Rather than store each as a separate
file, games pack them into one image called a **sprite sheet**, laid out in a grid.

Why bother? Because asking for one file is much faster than asking for twenty. A game with 500
separate tiny images spends most of its loading time on the *asking*, not the downloading.

> One 200 KB sheet beats twenty 10 KB files, every time.

## Sound and music

Two different jobs, and they get treated differently:

- **Sound effects** are short, played often, and need to start *instantly*. Kept small and
  uncompressed enough to fire with no delay.
- **Music** is long, played once, and can afford to be compressed hard because a fraction of a
  second of delay at the start doesn't matter.

The mistake beginners make is using a big compressed file for a sound effect, and then wondering
why the jump sound arrives after the jump.

```quiz
question: Why do games pack many small pictures into one big sprite sheet?
options:
  - Asking for one file is much faster than asking for twenty
  - Big images are always smaller than small ones
  - The engine cannot load more than one image
  - It makes the pictures look better
answer: 0
feedback:
  - Right. The cost is mostly in the number of requests, not the total size.
  - A sheet is bigger than any one tile — the win is in the count, not the size.
  - Engines can load plenty. This is about speed.
  - It looks identical. This is purely about loading.
explain: Each separate file is a separate request with its own overhead. Fewer, bigger files load faster than many tiny ones.
```

## Tilemaps: worlds from small squares

Mario's levels are not giant pictures. They're a grid of small square tiles — ground, brick, pipe,
sky — placed on a map. Each tile is drawn once and reused hundreds of times.

That's a **tilemap**, and it's why old games could hold enormous worlds in tiny memory. The level
isn't a picture; it's a list of numbers saying which tile goes where.

It has a second benefit that matters more today: a tilemap is **data**, so a level can be edited,
generated, or loaded from a file without touching any code. Minecraft is this idea taken to its
logical extreme.

## Why file size matters

You will be tempted to use a beautiful 4000-pixel-wide image for something drawn 40 pixels wide.
Don't.

An image drawn at 40 pixels only needs about 80 pixels of detail (double, for sharp screens).
Everything beyond that is download time and memory for detail nobody can see. On a school network
with thirty people loading at once, that's the difference between a lesson starting and a lesson
being about waiting.

**Rule of thumb:** an image should be no more than about twice the size it's drawn at.

```challenge
title: Lab — the sprite that never appears
task: The code asks for a picture that isn't there, so nothing is drawn. Ask for one that exists instead, and notice how the game tells you it could not find something.
hint: Look at `wanted` and compare it, letter by letter, with what is actually in `owned`. Names have to match exactly.
solution: |
  // The goal: draw a sprite the game actually owns.
  const owned = ["player", "coin-gold", "sky", "grass"];
  const wanted = "coin-gold";          // a name that is really in the list
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
  ctx.fillText("owned: " + owned.join(", "), 10, 20);
  ctx.fillText("asked for: " + wanted, 10, 40);
  if (owned.indexOf(wanted) >= 0) {
    ctx.fillStyle = "#f5b02e"; ctx.fillRect(130, 80, 24, 24);
    ctx.fillStyle = "#3ddc84"; ctx.fillText("Drew " + wanted, 10, 140);
    win();
  } else {
    ctx.fillStyle = "#f5b02e";
    ctx.fillText("Could not load: " + wanted, 10, 140);
    ctx.fillText("(nothing gets drawn, and the screen stays empty)", 10, 160);
  }
code: |
  // The goal: draw a sprite the game actually owns.
  const owned = ["player", "coin-gold", "sky", "grass"];
  const wanted = "gold-coin";          // is this really what it is called?
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
  ctx.fillText("owned: " + owned.join(", "), 10, 20);
  ctx.fillText("asked for: " + wanted, 10, 40);
  if (owned.indexOf(wanted) >= 0) {
    ctx.fillStyle = "#f5b02e"; ctx.fillRect(130, 80, 24, 24);
    ctx.fillStyle = "#3ddc84"; ctx.fillText("Drew " + wanted, 10, 140);
    win();
  } else {
    ctx.fillStyle = "#f5b02e";
    ctx.fillText("Could not load: " + wanted, 10, 140);
    ctx.fillText("(nothing gets drawn, and the screen stays empty)", 10, 160);
  }
```

A wrong asset name is the single most common reason a game shows a blank screen. It's also the
reason the AI in this app is *checked* before it's trusted — inventing a picture that doesn't exist
was the number one way it used to break people's games.

```quiz
question: You use a 4000-pixel-wide image for a coin that appears 30 pixels wide. What is the problem?
options:
  - It downloads and uses memory for detail nobody can see
  - The coin will look blurry
  - The engine cannot load images that big
  - Nothing, bigger is always better
answer: 0
feedback:
  - Right. It looks identical and costs a hundred times more to load.
  - It will look fine — just very expensive.
  - It can load it. That is not the issue.
  - On a shared school connection, bigger is how a lesson turns into waiting.
explain: An image needs about twice the pixels it is drawn at. Beyond that you are paying loading time for detail that never reaches the screen.
```

```yourturn
title: Add an asset you own to your game
task: Pick something from the Store you already own and put it in your game by name.
steps:
  - Open the Store from the top bar and find something marked Free or Owned. Note its green key — that is its exact name.
  - Open the Code tab and go to world.js.
  - Add it with `this.add.sprite(x, y, "the-key")`, using the key exactly as it is written.
  - Press Run. If nothing appears, open the console and look — a name that does not match is the usual reason.
reward: Asset Handler badge
```

## Recap

- A game is mostly **assets**; code is the small part that decides what to do with them.
- A **sprite sheet** packs many pictures into one file, because asking costs more than downloading.
- **Sound effects** need to be instant; music can be compressed hard.
- A **tilemap** builds a world from reused squares, and is data rather than a picture.
- Keep images to about **twice the size they are drawn at**.
- A **wrong asset name** is the most common cause of a blank screen.
