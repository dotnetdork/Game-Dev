// game.js - Star Catcher
const CONFIG = { fallSpeed: 160, bombChance: 0.15, paddleWidth: 100, spawnEvery: 750, starPoints: 10 };
const WIDTH = 800, HEIGHT = 600;
function drawStar(g, cx, cy, spikes, outer, inner) {
  let rot = -Math.PI / 2; const step = Math.PI / spikes;
  g.beginPath(); g.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
  for (let i = 0; i < spikes; i++) { rot += step; g.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner); rot += step; g.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer); }
  g.closePath(); g.fillPath();
}
function buildTextures(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x35c2f5, 1); g.fillRoundedRect(0, 0, CONFIG.paddleWidth, 24, 10); g.generateTexture('player', CONFIG.paddleWidth, 24); g.clear();
  g.fillStyle(0xffd23f, 1); drawStar(g, 17, 17, 5, 16, 8); g.generateTexture('star', 34, 34); g.clear();
  g.fillStyle(0xe94b4b, 1); g.fillCircle(16, 18, 13); g.generateTexture('bomb', 34, 34); g.destroy();
}
function create() {
  const scene = this; buildTextures(scene);
  scene.score = 0; scene.lives = 3; scene.isOver = false;
  scene.player = scene.physics.add.sprite(WIDTH / 2, HEIGHT - 40, 'player'); scene.player.setCollideWorldBounds(true);
  scene.stars = scene.physics.add.group(); scene.bombs = scene.physics.add.group();
  scene.physics.add.overlap(scene.player, scene.stars, collectStar, null, scene);
  scene.physics.add.overlap(scene.player, scene.bombs, hitBomb, null, scene);
  scene.cursors = scene.input.keyboard.createCursorKeys(); scene.keys = scene.input.keyboard.addKeys('A,D');
  scene.input.on('pointermove', function (p) { if (!scene.isOver) scene.player.x = Phaser.Math.Clamp(p.worldX, CONFIG.paddleWidth / 2, WIDTH - CONFIG.paddleWidth / 2); });
  scene.input.on('pointerdown', function () { if (scene.isOver) scene.scene.restart(); });
  scene.scoreText = scene.add.text(16, 14, 'Score: 0', { fontFamily: 'Arial', fontSize: '22px', color: '#eaf1f8' }).setDepth(10);
  scene.livesText = scene.add.text(WIDTH - 16, 14, 'Lives: 3', { fontFamily: 'Arial', fontSize: '22px', color: '#f5b02e' }).setOrigin(1, 0).setDepth(10);
  scene.time.addEvent({ delay: CONFIG.spawnEvery, loop: true, callback: function () { if (!scene.isOver) spawnObject(scene); } });
  postStats(scene);
}
function update() {
  const scene = this; if (scene.isOver) return;
  scene.player.setVelocityX(0);
  if (scene.cursors.left.isDown || scene.keys.A.isDown) scene.player.setVelocityX(-520);
  else if (scene.cursors.right.isDown || scene.keys.D.isDown) scene.player.setVelocityX(520);
  const clean = function (grp) { grp.children.iterate(function (o) { if (o && o.y > HEIGHT + 40) o.destroy(); }); };
  clean(scene.stars); clean(scene.bombs);
}
function spawnObject(scene) {
  const x = Phaser.Math.Between(30, WIDTH - 30); const fall = CONFIG.fallSpeed + scene.score * 1.2;
  if (Math.random() < CONFIG.bombChance) { const b = scene.bombs.create(x, -20, 'bomb'); b.setVelocityY(fall * 0.95); b.setAngularVelocity(120); }
  else { const s = scene.stars.create(x, -20, 'star'); s.setVelocityY(fall); s.setAngularVelocity(180); }
}
function collectStar(player, star) { star.destroy(); this.score += CONFIG.starPoints; this.scoreText.setText('Score: ' + this.score); postStats(this); }
function hitBomb(player, bomb) {
  bomb.destroy(); this.lives -= 1; this.livesText.setText('Lives: ' + this.lives); this.cameras.main.shake(160, 0.01); postStats(this);
  if (this.lives <= 0) { this.isOver = true; this.add.rectangle(WIDTH/2, HEIGHT/2, WIDTH, HEIGHT, 0x0b1a2e, 0.8).setDepth(20); this.add.text(WIDTH/2, HEIGHT/2 - 20, 'Game Over', { fontFamily: 'Arial', fontSize: '52px', color: '#eaf1f8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(21); this.add.text(WIDTH/2, HEIGHT/2 + 40, 'Click to play again', { fontFamily: 'Arial', fontSize: '18px', color: '#7c93ae' }).setOrigin(0.5).setDepth(21); }
}
function postStats(scene) { try { if (window.parent) window.parent.postMessage({ type: 'stats', score: scene.score, lives: scene.lives }, '*'); } catch (e) {} }
