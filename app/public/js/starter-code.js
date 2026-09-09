/* starter-code.js — The starter game the student begins from, split into small files the way a
   real game is: settings, world, player, coins, the scene that wires them, and the boot file.
   Loaded into the project on first run or on Reset. Each file is its own tab in the Code view. */

const STARTER = {};
/* design.md sits first because it is the only file here that is about the game the student is going
   to make rather than the one they have been given, and the Code tab is where they will look for
   it. It is not code: the game runner, the linter and the practice checker all skip it — see
   isCodeFile in project.js. */
const STARTER_ORDER = ['design.md', 'config.js', 'world.js', 'player.js', 'coins.js', 'game.js', 'main.js'];

/* ------------------------------------------------------------------ design.md */
/* The one-sheet. Five slots, deliberately — a design doc a twelve-year-old will actually fill in is
   a pitch card, not a specification. Its job is not to describe a game, it is to make them CUT: the
   last slot is the one no template has and the one that does the work.
   It ships empty and stays empty until the Concept Ideation module, which is why the top of it says so
   rather than looking like homework nobody set. */
STARTER['design.md'] = `# My game

Nothing here yet — and that is fine. You fill this in during **Concept Ideation**.

Right now the game in the other files is the one you were handed. This page is where it turns
into yours. Real studios write one of these before they build anything, and it fits on one page
on purpose: if your idea does not fit on one page, it will not fit in one term either.


## My game is...

(One sentence. Not a paragraph. "A platformer where you are a ghost who can only move
when nobody is looking.")


## The one thing you do

(Every game is one verb done well. Mario's is jump. Minecraft's is dig. What is yours?)


## How you win

(What has to happen for someone to say "I did it"?)


## How you lose

(If you cannot lose, you cannot win. What goes wrong?)


## What makes it mine

(The twist. The bit that is not in anybody else's version.)


## What I am NOT building

(The most important box on this page. Write down the ideas you love and are cutting anyway,
so you stop thinking about them. You can always build them next time.)
`;

/* ------------------------------------------------------------------ config.js */
STARTER['config.js'] = `// ============================================================
//  config.js  -  All the numbers you can tweak.
//
//  This is the best file to experiment in. Change a number,
//  press Run, and see what it does to your game.
//  Nothing here is code that "does" anything - they are just
//  the settings the rest of your game reads.
// ============================================================

const CONFIG = {
  moveSpeed: 110,   // how fast the player walks (bigger = faster)
  jumpPower: 260,   // how high the player jumps (bigger = higher)
  gravity: 420,     // how hard everything falls (bigger = heavier)
  coinBounce: 0.3   // how much a coin bounces when it lands (0 = none)
};

// The size of the game world, in pixels.
//
// This is small on purpose. The art is 1-bit pixel art drawn at
// 16x16, so the world is measured in those little tiles - 25
// across and 19 down. Phaser stretches the whole thing up to fill
// the window, so small here does NOT mean small on screen.
const TILE = 16;
const WIDTH = 400;
const HEIGHT = 304;
`;

/* ------------------------------------------------------------------ world.js */
STARTER['world.js'] = `// ============================================================
//  world.js  -  Builds the level: the ground and the platforms
//               you jump on.
//
//  Want a bigger level? A different shape? This is the file.
// ============================================================


// The name of the block the whole level is built out of.
// Every picture in the Store has a name like this. Swap it for
// another one you own and the whole level changes at once.
const BLOCK = '1bit-platformer_tile_0375';


// Build the floor and the floating platforms.
// A "static group" is a set of things that never move.
function buildPlatforms(scene) {
  const ground = scene.physics.add.staticGroup();

  // A row of blocks across the bottom makes the floor.
  // One block is TILE wide, so stepping by TILE lays them
  // edge to edge with no gaps.
  for (let x = 0; x < WIDTH + TILE; x += TILE) {
    ground.create(x, HEIGHT - TILE / 2, BLOCK);
  }

  // A few floating platforms to jump onto.
  // Try adding another line here!
  buildPlatform(ground, 300, 210, 4);
  buildPlatform(ground, 90, 160, 3);
  buildPlatform(ground, 230, 110, 2);

  return ground;
}


// Lay "howMany" blocks in a row, starting at x, to make one
// platform. Written once here so the lines above stay short.
function buildPlatform(ground, x, y, howMany) {
  for (let i = 0; i < howMany; i++) {
    ground.create(x + i * TILE, y, BLOCK);
  }
}
`;

/* ------------------------------------------------------------------ player.js */
STARTER['player.js'] = `// ============================================================
//  player.js  -  Everything about the player: making them,
//                and moving them when you press the keys.
// ============================================================


// Put the player into the world and set up the keyboard.
function createPlayer(scene) {
  const player = scene.physics.add.sprite(60, 120, '1bit-platformer_tile_0340');
  player.setCollideWorldBounds(true);        // don't walk off-screen

  // Set up the keys so movePlayer() can read them later.
  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.keys = scene.input.keyboard.addKeys('W,A,S,D');   // WASD works too

  return player;
}


// Runs every frame. Reads the keyboard and moves the player.
function movePlayer(scene) {
  // Arrow keys OR W / A / S / D both work.
  const left = scene.cursors.left.isDown || scene.keys.A.isDown;
  const right = scene.cursors.right.isDown || scene.keys.D.isDown;
  const jump = scene.cursors.up.isDown || scene.keys.W.isDown;

  if (left) {
    scene.player.setVelocityX(-CONFIG.moveSpeed);
  } else if (right) {
    scene.player.setVelocityX(CONFIG.moveSpeed);
  } else {
    scene.player.setVelocityX(0);
  }

  // Only allow a jump when the player is standing on something.
  const onGround = scene.player.body.blocked.down;

  if (jump && onGround) {
    scene.player.setVelocityY(-CONFIG.jumpPower);
    scene.sound.play('sfx-jump');
  }
}
`;

/* ------------------------------------------------------------------ coins.js */
STARTER['coins.js'] = `// ============================================================
//  coins.js  -  The coins you collect, and the score.
//
//  This is a good file to copy if you want to add a NEW kind
//  of thing to collect.
// ============================================================


// Where each coin starts. Add a pair to add a coin!
const COIN_SPOTS = [[130, 0], [215, 0], [280, 0], [316, 180], [106, 130]];


// Create all the coins and drop them into the world.
function createCoins(scene) {
  const coins = scene.physics.add.group();

  COIN_SPOTS.forEach(function (spot) {
    const coin = coins.create(spot[0], spot[1], '1bit-platformer_tile_0002');
    coin.setBounceY(CONFIG.coinBounce);      // a little bounce when it lands
  });

  return coins;
}


// Show the score in the top-left corner.
function createScoreText(scene) {
  scene.score = 0;
  return scene.add.text(8, 8, 'Coins: 0', {
    fontSize: '14px',
    color: '#ffffff'
  });
}


// Runs whenever the player touches a coin.
function collectCoin(player, coin) {
  const scene = this;

  coin.disableBody(true, true);                    // hide the coin we grabbed
  scene.sound.play('sfx-coin');

  scene.score += 1;
  scene.scoreText.setText('Coins: ' + scene.score);
}
`;

/* ------------------------------------------------------------------ game.js */
STARTER['game.js'] = `// ============================================================
//  game.js  -  The heart of your game.
//
//  This file is short on purpose. It doesn't build anything
//  itself - it calls the helpers in the other files, in order.
//  Read it top to bottom to see how your game fits together.
//
//  A Phaser game runs three functions for you:
//    preload()  -> load pictures/sounds (runs once, first)
//    create()   -> build the level      (runs once, next)
//    update()   -> the game loop        (runs ~60 times a second)
// ============================================================


// ------------------------------------------------------------
//  preload()  -  loads the pictures and sounds you own.
//  (You can see them in the "assets" folder on the Code tab.)
// ------------------------------------------------------------
function preload() {
  if (typeof preloadAssets === 'function') {
    preloadAssets(this);
  }
}


// ------------------------------------------------------------
//  create()  -  builds the level, once, when the game starts.
// ------------------------------------------------------------
function create() {
  const scene = this;

  // 1) The level itself  (see world.js)
  scene.ground = buildPlatforms(scene);

  // 2) The player        (see player.js)
  scene.player = createPlayer(scene);

  // 3) The coins         (see coins.js)
  scene.coins = createCoins(scene);
  scene.scoreText = createScoreText(scene);

  // 4) Rules: what bumps into what?
  scene.physics.add.collider(scene.player, scene.ground);
  scene.physics.add.collider(scene.coins, scene.ground);
  scene.physics.add.overlap(scene.player, scene.coins, collectCoin, null, scene);
}


// ------------------------------------------------------------
//  update()  -  the game loop. Runs about 60 times a second.
// ------------------------------------------------------------
function update() {
  const scene = this;

  movePlayer(scene);   // see player.js
}
`;

/* ------------------------------------------------------------------ main.js */
STARTER['main.js'] = `// ============================================================
//  main.js  -  Starts the game engine (Phaser).
//
//  This file runs LAST, once every other file has loaded.
//  You usually don't need to change much in here.
// ============================================================

const config = {
  type: Phaser.AUTO,             // let Phaser pick the best way to draw
  width: WIDTH,                  // game width  (from config.js)
  height: HEIGHT,                // game height (from config.js)
  parent: 'game',                // the box on the page to draw into
  backgroundColor: '#12213a',    // the colour behind everything
  pixelArt: true,                // keep the pixels crisp, do not blur them

  // Scale the game to fit its box, and keep it centered.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  // Gravity makes things fall. Bigger = heavier.
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: CONFIG.gravity }, debug: false }
  },

  // Connect our functions from game.js to the engine.
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

// Start the game!
new Phaser.Game(config);
`;
