// ============================================================
//  game.js  -  Your Platformer
//
//  HOW TO PLAY:
//    - Press the LEFT and RIGHT arrow keys to walk.
//    - Press the UP arrow key to jump.
//    - Try to collect all of the coins!
//
//  A Phaser game runs three functions for you:
//    preload()  -> load pictures/sounds (runs once, first)
//    create()   -> build the level      (runs once, next)
//    update()   -> the game loop        (runs ~60 times a second)
// ============================================================

// CONFIG holds numbers you can change to change how the game feels.
// Tweak these, press Run, and see what happens!
const CONFIG = {
  moveSpeed: 220, // how fast the player walks (bigger = faster)
  jumpPower: 520, // how high the player jumps  (bigger = higher)
};

// The size of the game world, in pixels.
const WIDTH = 800;
const HEIGHT = 600;

// ------------------------------------------------------------
//  preload()  -  runs ONCE, before anything else.
//  This loads the pictures and sounds you own from the Store.
//  (You can see them in the "assets" folder on the Code tab.)
// ------------------------------------------------------------
function preload() {
  if (typeof preloadAssets === 'function') {
    preloadAssets(this);
    console.log();
  }
}

// ------------------------------------------------------------
//  create()  -  runs ONCE, right after preload.
//  This is where we build the level.
// ------------------------------------------------------------
function create() {
  // 1) Draw the sky as a background, in the middle of the screen.
  this.add.image(WIDTH / 2, HEIGHT / 2, 'sky').setDisplaySize(WIDTH, HEIGHT);

  // 2) Build the ground and some platforms.
  //    A "static group" is a set of things that never move.
  const ground = this.physics.add.staticGroup();

  // Lay a row of grass blocks across the bottom to make the floor.
  for (let x = 0; x <= WIDTH; x += 70) {
    ground.create(x, HEIGHT - 30, 'grass');
  }

  // A few floating platforms to jump onto.
  ground.create(620, 430, 'grass');
  ground.create(690, 430, 'grass');
  ground.create(180, 330, 'grass');

  // 3) Add the player. A "sprite" is a picture that can move.
  this.player = this.physics.add.sprite(120, 200, 'player');
  this.player.setCollideWorldBounds(true); // don't walk off-screen

  // Make the player stand ON the ground instead of falling through it.
  this.physics.add.collider(this.player, ground);

  // 4) Add some coins to collect.
  this.coins = this.physics.add.group();

  const coinSpots = [
    [250, 0],
    [430, 0],
    [560, 0],
    [640, 360],
    [180, 260],
  ];
  coinSpots.forEach(function (spot) {
    const coin = this.coins.create(spot[0], spot[1], 'coin-gold');
    coin.setBounceY(0.3); // a little bounce when it lands
  }, this);

  // Coins should land on the ground too.
  this.physics.add.collider(this.coins, ground);

  // When the player touches a coin, run collectCoin().
  this.physics.add.overlap(this.player, this.coins, collectCoin, null, this);

  // 5) Show the score in the top-left corner.
  this.score = 0;
  this.scoreText = this.add.text(16, 16, 'Coins: 0', {
    fontSize: '24px',
    color: '#ffffff',
  });

  // 6) Set up the arrow keys so update() can read them.
  this.cursors = this.input.keyboard.createCursorKeys();
  this.keys = this.input.keyboard.addKeys('W,A,S,D'); // WASD works too
  this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
}

// ------------------------------------------------------------
//  collectCoin()  -  runs whenever the player touches a coin.
// ------------------------------------------------------------
function collectCoin(player, coin) {
  coin.disableBody(true, true); // hide the coin we grabbed
  this.sound.play('sfx-confirm'); // play the coin sound

  this.score += 1; // add one to the score
  this.scoreText.setText('Coins: ' + this.score); // update the text
}

// ------------------------------------------------------------
//  update()  -  the game loop. Runs about 60 times a second.
//  This is where we read the keyboard and move the player.
// ------------------------------------------------------------
function update() {
  // Arrow keys OR W / A / S / D both work.
  const left = this.cursors.left.isDown || this.keys.A.isDown;
  const right = this.cursors.right.isDown || this.keys.D.isDown;
  const jump = this.spacebar.isDown;

  if (left) {
    this.player.setVelocityX(-CONFIG.moveSpeed);
    this.player.setTexture('alienGreen_walk1'); // Swap texture for moving left
    this.player.setFlipX(true); // Flip image to face left
  } else if (right) {
    this.player.setVelocityX(CONFIG.moveSpeed);
    this.player.setTexture('alienGreen_walk1'); // Swap texture for moving right
    this.player.setFlipX(false); // Reset flip to face right
  } else {
    this.player.setVelocityX(0);
    this.player.setTexture('player'); // Return to default idle texture
  }

  // Only allow a jump when the player is standing on the ground.
  const onGround = this.player.body.blocked.down;

  if (jump && onGround) {
    this.player.setVelocityY(-CONFIG.jumpPower);
    this.sound.play('sfx-jump'); // play the jump sound
  }
}