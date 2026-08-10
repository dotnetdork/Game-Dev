/* starter-code.js — The starter game the student begins from, split into small files the way a
   real game is: settings, world, player, coins, the scene that wires them, and the boot file.
   Loaded into the project on first run or on Reset. Each file is its own tab in the Code view. */

const STARTER = {};
const STARTER_ORDER = ['config.js', 'world.js', 'player.js', 'coins.js', 'game.js', 'main.js'];

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
  moveSpeed: 220,   // how fast the player walks (bigger = faster)
  jumpPower: 520,   // how high the player jumps (bigger = higher)
  gravity: 800,     // how hard everything falls (bigger = heavier)
  coinBounce: 0.3   // how much a coin bounces when it lands (0 = none)
};

// The size of the game world, in pixels.
const WIDTH = 800;
const HEIGHT = 600;
`;

/* ------------------------------------------------------------------ world.js */
STARTER['world.js'] = `// ============================================================
//  world.js  -  Builds the level: the sky, the ground and the
//               platforms you jump on.
//
//  Want a bigger level? A different shape? This is the file.
// ============================================================


// Draw the sky behind everything else.
function buildSky(scene) {
  scene.add.image(WIDTH / 2, HEIGHT / 2, 'sky').setDisplaySize(WIDTH, HEIGHT);
}


// Build the floor and the floating platforms.
// A "static group" is a set of things that never move.
function buildPlatforms(scene) {
  const ground = scene.physics.add.staticGroup();

  // A row of grass blocks across the bottom makes the floor.
  for (let x = 0; x <= WIDTH; x += 70) {
    ground.create(x, HEIGHT - 30, 'grass');
  }

  // A few floating platforms to jump onto.
  // Try adding another line here!
  ground.create(620, 430, 'grass');
  ground.create(690, 430, 'grass');
  ground.create(180, 330, 'grass');

  return ground;
}
`;

/* ------------------------------------------------------------------ player.js */
STARTER['player.js'] = `// ============================================================
//  player.js  -  Everything about the player: making them,
//                and moving them when you press the keys.
// ============================================================


// Put the player into the world and set up the keyboard.
function createPlayer(scene) {
  const player = scene.physics.add.sprite(120, 200, 'player');
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
const COIN_SPOTS = [[250, 0], [430, 0], [560, 0], [640, 360], [180, 260]];


// Create all the coins and drop them into the world.
function createCoins(scene) {
  const coins = scene.physics.add.group();

  COIN_SPOTS.forEach(function (spot) {
    const coin = coins.create(spot[0], spot[1], 'coin-gold');
    coin.setBounceY(CONFIG.coinBounce);      // a little bounce when it lands
  });

  return coins;
}


// Show the score in the top-left corner.
function createScoreText(scene) {
  scene.score = 0;
  return scene.add.text(16, 16, 'Coins: 0', {
    fontSize: '24px',
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
  buildSky(scene);
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
  backgroundColor: '#7ec0ee',    // sky blue, shown behind everything

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
