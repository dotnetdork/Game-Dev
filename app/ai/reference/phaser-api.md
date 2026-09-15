# Phaser 4 quick reference

The APIs this course actually uses. `search_phaser_docs` searches this file, so the AI looks
things up here instead of guessing. Each entry is one block; the `##` heading and the keywords
line are what get matched.

Add to this file rather than letting the AI invent APIs — a wrong method name crashes a game.

## Adding a sprite
keywords: sprite, image, add, player, enemy, character, show, draw a picture
```javascript
const player = scene.physics.add.sprite(x, y, 'player');   // has a physics body, can move and collide
const bg     = scene.add.image(x, y, 'sky');               // no body, just a picture
```
The third argument is an asset key the student owns. An unknown key loads nothing and breaks the game.

## Moving something
keywords: move, velocity, speed, walk, run, push, direction
```javascript
sprite.setVelocityX(200);      // pixels per second, negative goes left
sprite.setVelocityY(-400);     // negative is UP
sprite.setVelocity(100, -50);
```

## Gravity, bounce and world edges
keywords: gravity, fall, bounce, bouncy, world bounds, edge, off screen
```javascript
sprite.setCollideWorldBounds(true);   // stops at the edge of the screen
sprite.setBounceY(0.4);               // 0 = no bounce, 1 = full bounce
sprite.body.allowGravity = false;     // this one thing ignores gravity
```
World gravity is set once in main.js: `physics: { arcade: { gravity: { y: 800 } } }`.

## Jumping
keywords: jump, hop, leap, double jump, on the ground, standing
```javascript
const onGround = sprite.body.blocked.down;   // true when standing on something
if (jumpPressed && onGround) sprite.setVelocityY(-CONFIG.jumpPower);
```

## Reading the keyboard
keywords: key, keyboard, arrow, wasd, shift, space, press, input, control
```javascript
scene.cursors = scene.input.keyboard.createCursorKeys();  // up down left right space AND shift
scene.keys    = scene.input.keyboard.addKeys('W,A,S,D');  // any other keys, registered up front

if (scene.cursors.left.isDown)  { }
if (scene.cursors.shift.isDown) { }    // Shift is already here — do NOT add it to addKeys
if (scene.keys.W.isDown)        { }
```
There is no `scene.input.keyboard.isDown(...)`. Reading a key you never registered crashes on the first frame.

## Groups (many of the same thing)
keywords: group, many, several, spawn, coins, enemies, bullets, list
```javascript
const coins = scene.physics.add.group();
const coin  = coins.create(x, y, 'coin-gold');
coins.children.iterate(function (c) { if (c) c.setAngularVelocity(60); });
```

## Collisions and overlaps
keywords: collide, hit, touch, overlap, collect, pick up, land on, bump
```javascript
scene.physics.add.collider(player, platforms);                       // solid: pushes apart
scene.physics.add.overlap(player, coins, collectCoin, null, scene);  // passes through, runs a function
```
The callback gets `(objectA, objectB)`. Inside it, `this` is the scene when you pass the scene as the last argument.

## Removing something
keywords: remove, delete, destroy, hide, disappear, kill
```javascript
coin.disableBody(true, true);   // hide it but keep it for reuse
enemy.destroy();                // gone for good
```

## Text on screen
keywords: text, score, label, words, number, display, hud, ui
```javascript
scene.scoreText = scene.add.text(16, 16, 'Coins: 0', { fontSize: '24px', color: '#ffffff' });
scene.scoreText.setText('Coins: ' + scene.score);
```
`add.text`'s third argument is the words to show — it is NOT an asset key.

## Sound
keywords: sound, audio, noise, play, sfx, music
```javascript
scene.sound.play('sfx-jump');   // must be a sound key the student owns
```

## Timers and repeating events
keywords: timer, delay, wait, every, repeat, spawn over time, seconds
```javascript
scene.time.addEvent({ delay: 1000, loop: true, callback: function () { spawnThing(scene); } });
scene.time.delayedCall(500, function () { });
```

## Tweens (smooth movement over time)
keywords: tween, smooth, animate, fade, grow, shrink, slide, ease
```javascript
scene.tweens.add({ targets: coin, y: coin.y - 30, alpha: 0, duration: 400 });
```

## Rotating and scaling
keywords: rotate, spin, turn, angle, scale, size, bigger, smaller, flip
```javascript
sprite.setAngle(45);              // degrees
sprite.setAngularVelocity(120);   // degrees per second — this is how you make something spin
sprite.setScale(2);
sprite.setFlipX(true);
```

## Camera effects
keywords: camera, shake, flash, follow, zoom, screen
```javascript
scene.cameras.main.shake(200, 0.01);
scene.cameras.main.flash(300);
scene.cameras.main.startFollow(player);
```

## Drawing shapes
keywords: draw, shape, rectangle, circle, graphics, colour, color, texture
```javascript
const g = scene.make.graphics({ add: false });
g.fillStyle(0xff0000, 1);
g.fillRect(0, 0, 40, 20);
g.fillRoundedRect(0, 0, 40, 20, 6);
g.fillCircle(20, 20, 20);
g.fillTriangle(0, 40, 20, 0, 40, 40);
g.generateTexture('myShape', 40, 40);    // now usable as an asset key
```
Graphics has **no** `cubicCurveTo`, `bezierCurveTo`, `arcTo` or `arc` — those are HTML-canvas methods and will crash.
For a simple coloured box or oval that does not need to be a texture, `scene.add.rectangle(x, y, w, h, 0xff0000)` and `scene.add.ellipse(...)` are fine.

## Restarting the scene
keywords: restart, reset, game over, play again, start over
```javascript
scene.scene.restart();
```
