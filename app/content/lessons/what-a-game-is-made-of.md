---
title: What a Game Is Made Of
xp: 200
ai: full
summary: Sprites, sheets, sounds and tilemaps — the pieces behind the picture.
---

Open any game's folder and you'll find thousands of files. Almost none of them are code.

A game is mostly **assets**: pictures, sounds, fonts, maps. The code is the small part that decides
what to do with them. Minecraft is a few hundred textures and a rulebook.

```run
// @goal: Change how much art the game has, and watch what happens to the share that is code.
// @slider: assetFiles 20 3000 20 1200
const codeFiles = 40;
const total = assetFiles + codeFiles;
console.log("pictures, sounds and maps: " + assetFiles);
console.log("files of code:             " + codeFiles);
console.log("code is " + (codeFiles / total * 100).toFixed(1) + "% of this game");
```

## Sprites and sprite sheets

<figure class="art aside">
  <div class="art-row">
    <span class="art-cell"><img src="/assets/player.png" alt="The player character standing"><b>player</b></span>
    <span class="art-cell"><img src="/assets/coin-gold.png" alt="A gold coin"><b>coin-gold</b></span>
    <span class="art-cell"><img src="/assets/slimeGreen.png" alt="A green slime enemy"><b>slimeGreen</b></span>
    <span class="art-cell"><img src="/assets/heart.png" alt="A red heart, used for lives"><b>heart</b></span>
  </div>
  <figcaption>Four sprites you already own — they are free in every project. The name under each
  one is what you type to load it. <cite><b>Kenney</b> — Platformer Pack, public domain (CC0).</cite></figcaption>
</figure>

A **sprite** is a picture you can move around. Your player, a coin, an enemy — all sprites.

Drawing Mario walking takes several pictures shown in order. Rather than store each as a separate
file, games pack them into one image called a **sprite sheet**, laid out in a grid.

Why bother? Because asking for one file is much faster than asking for twenty. A game with 500
separate tiny images spends most of its loading time on the *asking*, not the downloading.

> One 200 KB sheet beats twenty 10 KB files, every time.

<figure class="art">
  <div class="art-row tiles">
    <img src="/assets/grassLeft.png" alt="A grass tile with a finished left edge">
    <img src="/assets/grass.png" alt="A middle grass tile">
    <img src="/assets/grass.png" alt="A middle grass tile">
    <img src="/assets/grass.png" alt="A middle grass tile">
    <img src="/assets/grass.png" alt="A middle grass tile">
    <img src="/assets/grassRight.png" alt="A grass tile with a finished right edge">
  </div>
  <figcaption>The floor in your game is not one long picture. It is three tiles — a left end, a
  middle repeated as many times as you need, a right end — butted together with no gap. That is why
  <code>grass</code> appears four times above, and why the ground can be any length you like
  without anyone drawing a new picture.
  <cite><b>Kenney</b> — Platformer Pack, public domain (CC0).</cite></figcaption>
</figure>

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

<figure class="diagram">
  <img src="/content/images/shots/mario-world-1-1.jpg" alt="The whole of Super Mario Bros World 1-1 laid out end to end, showing it is built from a small set of repeated block, brick and pipe tiles">
  <figcaption>All of World 1-1, laid out end to end. Count the different kinds of square: there are
  only a handful, used over and over. That is the entire level.
  <cite><b>Super Mario Bros. World 1-1</b> — Umweltschützen, CC BY-SA 3.0.</cite></figcaption>
</figure>

That's a **tilemap**, and it's why old games could hold enormous worlds in tiny memory. The level
isn't a picture; it's a list of numbers saying which tile goes where.

<figure class="shot">
  <img src="/content/images/shots/supertux-editor.jpg" alt="A level editor showing a game level built from repeated square tiles, with a palette of tile choices along the side">
  <figcaption>A level being built out of tiles, with the palette of available tiles down the side.
  The level is not a picture — it is a list saying which tile goes in which square, which is why it
  can be edited like this at all.
  <cite><b>SuperTux level editor</b> — SuperTux Development Team, level by Daniel Alston, screenshot by PantheraLeo1359531, CC BY-SA 3.0.</cite></figcaption>
</figure>

It has a second benefit that matters more today: a tilemap is **data**, so a level can be edited,
generated, or loaded from a file without touching any code. Minecraft is this idea taken to its
logical extreme.

```run
// @goal: A level is a list of numbers. Change how wide it is and read both the data and the picture.
// @slider: width 4 16 1 10
const tiles = ["sky", "grass", "brick"];
let level = [];
for (let i = 0; i < width; i++) {
  level.push(i === 0 || i === width - 1 ? 2 : (i % 3 === 0 ? 1 : 0));
}
console.log("stored as data:  " + level.join(" "));
console.log("drawn as tiles:  " + level.map(function (n) { return tiles[n]; }).join(", "));
console.log("that whole level is " + level.length + " numbers, not a picture");
```

## Why file size matters

You will be tempted to use a beautiful 4000-pixel-wide image for something drawn 40 pixels wide.
Don't.

An image drawn at 40 pixels only needs about 80 pixels of detail (double, for sharp screens).
Everything beyond that is download time and memory for detail nobody can see. On a school network
with thirty people loading at once, that's the difference between a lesson starting and a lesson
being about waiting.

**Rule of thumb:** an image should be no more than about twice the size it's drawn at.

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

Every picture in a game is loaded under a name, and the name has to match exactly. Here is one that does not.

```challenge
title: Lab — the sprite that never appears
task: The code asks for a picture that isn't there, so nothing is drawn. Ask for one that exists instead, and notice how the game tells you it could not find something.
goal: The sprite appears on screen instead of a blank space.
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

Right now every game in the room has the same little hero in it. Time to fix that. You have been
carrying **250 Stars** since you started, and the **Store** in the top bar is where they go.

```yourturn
title: Make the player yours
task: Buy a set of characters with the Stars you already have, pick the one you like, and put it in your game by name.
steps:
  - Open the **Store** from the top bar. The number with the star beside it is what you have to spend.
  - Find **Pixel Platformer characters** (150 ★) and buy it — the search box will find it. Twenty-seven characters, drawn at the same tiny size as your world.
  - Back on the **Code** tab, press **+** on the **assets** folder and pick your favourite. It joins your project, and the message at the bottom tells you its full name — something like `pixel-platformer_chr_tile_0004`.
  - "Open `player.js` and find `'1bit-platformer_tile_0340'` inside `createPlayer` — that is the picture your player is made from. Select it, quotes and all, then click your new character in the assets folder and press **Insert into code**. Or just type the name in its place."
  - Press **Play**. If the player vanishes, look in the console underneath — a name that does not match, letter for letter, is the usual reason.
check:
  - matches:
      file: player.js
      regex: 'pixel-platformer_chr_tile_\d+'
    hint: "`createPlayer` in player.js is still using the old picture — swap the name in quotes for the key of a character you bought."
  - parses: true
    hint: Something no longer parses — check the quotes around your key.
reward: Asset Handler badge
```

## Recap

- A game is mostly **assets**; code is the small part that decides what to do with them.
- A **sprite sheet** packs many pictures into one file, because asking costs more than downloading.
- **Sound effects** need to be instant; music can be compressed hard.
- A **tilemap** builds a world from reused squares, and is data rather than a picture.
- Keep images to about **twice the size they are drawn at**.
- A **wrong asset name** is the most common cause of a blank screen.
