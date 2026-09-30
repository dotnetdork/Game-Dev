// ================================================================
//  The intern's game: a platformer, made with Phaser.
//
//  The PARTS (Player, Ground, Coins, Lava...) and their settings
//  live in the Hierarchy and the Inspector. This file says how each
//  kind of part looks and how it behaves when the game runs.
//
//  Studio.part('coins')  reads a part's settings
//  Studio.playing        true in Play mode, false when stopped
//  Studio.event('coin')  tells the studio something happened
//
//  Every picture is drawn by this code (see SPRITES at the bottom),
//  so there are no image files to load, and you can add your own.
// ================================================================

class Level extends Phaser.Scene {
  constructor() { super('Level'); }

  preload() {
    // Every sound a part can use.
    for (const key in SOUNDS) this.load.audio(key, SOUNDS[key]);
  }

  create() {
    // Draw every sprite once, into a texture a part can wear.
    for (const key in SPRITES) {
      if (this.textures.exists(key)) continue;
      const [w, h, draw] = SPRITES[key];
      const g = this.make.graphics({ add: false });
      draw(g, w, h);
      g.generateTexture(key, w, h);
      g.destroy();
    }
    const level = Studio.part('level');
    this.cameras.main.setBackgroundColor('#9a9a9a');
    if (level.look) this.add.image(480, 270, level.look);
    this.physics.world.gravity.y = level.gravity;
    this.made = {};                       // the game objects each part is drawn with
    this.player = null;
    this.cleared = false;
    Studio.parts.forEach(p => this.build(p));
    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,UP,A,D,W,SPACE');
    // A setting changed in the Inspector: rebuild that part.
    Studio.onChange(id => this.rebuild(id));
    // Stopped, the level stands still; in Play mode it runs.
    if (Studio.playing) this.physics.resume(); else this.physics.pause();
  }

  // ---------- making each kind of part ----------
  build(p) {
    const things = [];
    if (p.kind === 'player') things.push(this.makePlayer(p));
    if (p.kind === 'floor') p.pieces.forEach(([x, w]) => things.push(this.makeFloor(p, x, w)));
    if (p.kind === 'lava') things.push(this.makeLava(p));
    if (p.kind === 'coin') p.spots.forEach(([x, y]) => things.push(this.makeCoin(p, x, y)));
    this.made[p.id] = things;
    if (p.kind !== 'player' && this.player) this.connect(p);
  }

  makePlayer(p) {
    const where = this.keep || { x: p.x, y: p.y };   // a rebuilt hero stays where it was
    this.keep = null;
    let hero;
    if (p.look === 'hero') {
      const s = p.shape || DEFAULT_HERO;
      drawHero(this, s);
      hero = this.physics.add.sprite(where.x, where.y, 'hero');
      // The hero's body, not its wings and horns. Its feet go where the grey box's feet were
      // (28 below the middle): a body that starts inside the floor falls straight through it,
      // and then respawns inside it again, forever.
      const [bx, by, bw, bh] = heroBody(s);
      hero.setOrigin((bx + bw / 2) / 80, (by + bh - 28) / 88);
      hero.body.setSize(bw, bh, false).setOffset(bx, by);
    } else {
      hero = this.add.rectangle(where.x, where.y, 40, 56, 0x4f4f4f);   // a grey box until it has a sprite
      this.physics.add.existing(hero);
    }
    paint(hero, p.tint);
    hero.body.setCollideWorldBounds(false);
    // Gravity Scale: 1 is normal. The world pulls everyone; this adds or takes away for the hero.
    hero.body.setGravityY(Studio.part('level').gravity * ((p.gravityScale ?? 1) - 1));
    this.player = hero;
    Studio.parts.forEach(q => { if (q.kind !== 'player' && this.made[q.id]) this.connect(q); });
    return hero;
  }

  // A block 64 pixels tall, plus whatever fills the space below it.
  block(p, x, y, w, art, grey, greyFill) {
    const top = art
      ? this.add.tileSprite(x + w / 2, y + 32, w, 64, art)
      : this.add.rectangle(x + w / 2, y + 32, w, 64, grey);
    const below = 540 - (y + 64);
    if (below > 0) {
      const under = art
        ? this.add.tileSprite(x + w / 2, y + 64 + below / 2, w, below, art + '_fill')
        : this.add.rectangle(x + w / 2, y + 64 + below / 2, w, below, greyFill);
      paint(under, p.tint);
      under.setData('trim', p.id);
    }
    paint(top, p.tint);
    return top;
  }

  makeFloor(p, x, w) {
    const floor = this.block(p, x, p.y, w, p.look, 0x6e6e6e, 0x5f5f5f);
    this.physics.add.existing(floor, true);
    // Box Collider 2D: only a SOLID floor holds the player up.
    floor.body.enable = p.solid;
    return floor;
  }

  makeLava(p) {
    const lava = this.block(p, p.x, p.y, p.w, p.look, 0x7c7c7c, 0x747474);
    this.physics.add.existing(lava, true);
    return lava;
  }

  makeCoin(p, x, y) {
    const coin = p.look
      ? this.add.image(x, y, p.look).setScale(p.size)
      : this.add.circle(x, y, 15 * p.size, 0xc4c4c4).setStrokeStyle(3, 0x8f8f8f);
    paint(coin, p.tint);
    this.physics.add.existing(coin, true);
    return coin;
  }

  // ---------- how parts touch each other ----------
  connect(p) {
    const hero = this.player;
    (this.made[p.id] || []).forEach(thing => {
      if (!thing.active) return;           // a coin already grabbed
      if (thing.link) thing.link.destroy();
      if (p.kind === 'floor') thing.link = this.physics.add.collider(hero, thing);
      if (p.kind === 'lava') thing.link = this.physics.add.collider(hero, thing, () => this.touchLava(p));
      if (p.kind === 'coin') thing.link = this.physics.add.overlap(hero, thing, () => this.grab(p, thing));
    });
  }

  touchLava(p) {
    if (p.hurts) { Studio.event('hurt'); this.respawn(); }
    else Studio.event('lava');            // the intern's lava is just a floor: it does nothing
  }

  grab(p, coin) {
    if (!coin.active) return;
    coin.link.destroy();
    coin.link = null;
    coin.destroy();
    if (p.sound) {
      this.sound.play(p.sound, { volume: p.volume ?? 0.6, rate: p.pitch ?? 1 });
      this.pop(SOUND_WORDS[p.sound], coin.x, coin.y);
    }
    Studio.event('coin');
    // Every coin grabbed: the level is cleared.
    const left = Studio.parts.filter(q => q.kind === 'coin').some(q => (this.made[q.id] || []).some(c => c.active));
    if (!left && !this.cleared) { this.cleared = true; Studio.event('cleared'); }
  }

  // A sound made visible, so a muted room sees it too.
  pop(word, x, y) {
    const text = this.add.text(x, y - 20, word, {
      fontFamily: 'system-ui, sans-serif', fontSize: '30px', fontStyle: '800',
      color: '#ffffff', stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5);
    this.tweens.add({ targets: text, y: y - 80, alpha: 0, duration: 900, ease: 'Cubic.easeOut',
                      onComplete: () => text.destroy() });
  }

  respawn() {
    const p = Studio.part('player');
    this.player.body.reset(p.x, p.y);     // moves the body too, not just the picture, and stops it
  }

  rebuild(id) {
    const p = Studio.part(id);
    (this.made[id] || []).forEach(thing => { if (thing.link) thing.link.destroy(); thing.link = null; thing.destroy(); });
    this.children.list.filter(c => c.getData && c.getData('trim') === id).forEach(c => c.destroy());
    if (p.kind === 'level') { this.scene.restart(); return; }
    if (p.kind === 'player') { this.keep = { x: this.player.x, y: this.player.y }; this.player = null; }
    this.build(p);
  }

  // ---------- every frame ----------
  update() {
    if (!Studio.playing || !this.player) return;
    const p = Studio.part('player'), body = this.player.body, k = this.keys;
    const left = k.LEFT.isDown || k.A.isDown, right = k.RIGHT.isDown || k.D.isDown;
    body.setVelocityX(left ? -p.speed : right ? p.speed : 0);
    if (this.player.setFlipX && (left || right)) this.player.setFlipX(left);
    const onGround = body.blocked.down || body.touching.down;
    if ((k.UP.isDown || k.W.isDown || k.SPACE.isDown) && onGround) body.setVelocityY(-p.jump);

    // Standing on the fixed floor tile, not jumping over it.
    const tile = Studio.part('tile');
    if (tile && tile.solid && onGround && tile.pieces.some(([x, w]) => this.player.x > x && this.player.x < x + w)) Studio.event('crossed');

    // Fell off the bottom of the level.
    if (this.player.y > 620) { Studio.event('fell'); this.respawn(); }
  }
}

// A part's Color setting: a tint on a picture, or the fill of a plain box.
function paint(thing, tint) {
  if (!tint) return;
  const c = parseInt(tint.slice(1), 16);
  if (thing.setTint) thing.setTint(c); else if (thing.setFillStyle) thing.setFillStyle(c);
}

// ---------- the pictures, drawn in code: key: [width, height, how to draw it] ----------
const SPRITES = {
  coin_gold: [32, 32, (g) => { g.fillStyle(0xb8860b).fillCircle(16, 16, 15); g.fillStyle(0xffd24a).fillCircle(16, 16, 12); g.fillStyle(0xfff1a8).fillRect(11, 8, 4, 10); }],
  coin_silver: [32, 32, (g) => { g.fillStyle(0x7d8a96).fillCircle(16, 16, 15); g.fillStyle(0xd3dbe3).fillCircle(16, 16, 12); g.fillStyle(0xffffff).fillRect(11, 8, 4, 10); }],
  gem_blue: [32, 32, (g) => { g.fillStyle(0x1f5fbf).fillTriangle(16, 2, 30, 14, 16, 30).fillTriangle(16, 2, 2, 14, 16, 30); g.fillStyle(0x6cc4ff).fillTriangle(16, 6, 25, 14, 16, 14).fillTriangle(16, 6, 7, 14, 16, 14); }],
  star: [32, 32, (g) => { g.fillStyle(0xffc83d).fillTriangle(16, 1, 21, 12, 11, 12).fillTriangle(1, 12, 31, 12, 16, 22).fillTriangle(16, 18, 6, 31, 11, 14).fillTriangle(16, 18, 26, 31, 21, 14); }],
  lava: [64, 64, (g) => { g.fillStyle(0xd9420b).fillRect(0, 8, 64, 56); g.fillStyle(0xff7a1a).fillRect(0, 0, 64, 12); for (let x = 0; x < 64; x += 16) g.fillStyle(0xffc23d).fillCircle(x + 8, 10, 5); g.fillStyle(0xff9a3d).fillCircle(20, 36, 4).fillCircle(46, 50, 3); }],
  lava_fill: [64, 64, (g) => { g.fillStyle(0xb8340a).fillRect(0, 0, 64, 64); g.fillStyle(0xd9420b).fillCircle(16, 20, 5).fillCircle(44, 44, 6); }],
  goo: [64, 64, (g) => { g.fillStyle(0x2e8b3a).fillRect(0, 8, 64, 56); g.fillStyle(0x6fdc5a).fillRect(0, 0, 64, 12); for (let x = 0; x < 64; x += 16) g.fillStyle(0xb6f58a).fillCircle(x + 8, 10, 5); }],
  goo_fill: [64, 64, (g) => { g.fillStyle(0x236e2d).fillRect(0, 0, 64, 64); g.fillStyle(0x2e8b3a).fillCircle(20, 24, 6).fillCircle(46, 46, 4); }],
  grass: [64, 64, (g) => { g.fillStyle(0x8b5a2b).fillRect(0, 0, 64, 64); g.fillStyle(0x5cb85c).fillRect(0, 0, 64, 16); g.fillStyle(0x7ed957).fillRect(0, 0, 64, 5); g.fillStyle(0x6f4520).fillRect(10, 30, 6, 6).fillRect(40, 44, 6, 6); }],
  grass_fill: [64, 64, (g) => { g.fillStyle(0x8b5a2b).fillRect(0, 0, 64, 64); g.fillStyle(0x6f4520).fillRect(12, 14, 6, 6).fillRect(42, 40, 6, 6); }],
  stone: [64, 64, (g) => { g.fillStyle(0x6b7280).fillRect(0, 0, 64, 64); g.fillStyle(0x9ca3af).fillRect(0, 0, 64, 6); g.fillStyle(0x4b5563).fillRect(0, 31, 64, 2).fillRect(31, 0, 2, 31).fillRect(15, 33, 2, 31).fillRect(47, 33, 2, 31); }],
  stone_fill: [64, 64, (g) => { g.fillStyle(0x5b616d).fillRect(0, 0, 64, 64); g.fillStyle(0x4b5563).fillRect(0, 31, 64, 2).fillRect(31, 0, 2, 31); }],
  hills: [960, 540, (g) => { [0x9fd8f5, 0xb3e0f7, 0xc7e8f9, 0xdaf0fb].forEach((c, i) => g.fillStyle(c).fillRect(0, i * 90, 960, 90)); g.fillStyle(0xdaf0fb).fillRect(0, 360, 960, 180);
    g.fillStyle(0xffffff).fillEllipse(180, 90, 140, 40).fillEllipse(640, 130, 180, 44); g.fillStyle(0x9ad48a).fillEllipse(200, 470, 700, 300).fillEllipse(760, 480, 640, 260); g.fillStyle(0x7cc26c).fillEllipse(520, 520, 800, 220); }],
  night: [960, 540, (g) => { g.fillStyle(0x0d1b3a).fillRect(0, 0, 960, 540); g.fillStyle(0xfdf6d8).fillCircle(820, 90, 38); g.fillStyle(0x0d1b3a).fillCircle(836, 80, 34);
    for (let i = 0; i < 60; i++) g.fillStyle(0xffffff).fillRect((i * 137) % 960, (i * 61) % 380, 2, 2); g.fillStyle(0x1b2d52).fillEllipse(300, 520, 800, 260).fillEllipse(820, 530, 600, 220); }]
};

// ---------- your hero, drawn from parts ----------
// The hero's `shape` (in the Inspector, and what the studio's AI makes
// when you describe a hero) says which body, colours, eyes and extras.
const DEFAULT_HERO = { body: 'box', color: '#5aa9e6', eyes: 'dots', extras: [] };
// Where each body sits in the 80×88 picture: [x, y, width, height]. The game stands on this box.
const HERO_BODIES = { box: [20, 24, 40, 56], round: [18, 28, 44, 52], tall: [24, 18, 32, 62], blob: [14, 40, 52, 40], wide: [12, 36, 56, 44] };
const heroBody = s => HERO_BODIES[s.body] || HERO_BODIES.box;
function drawHero(scene, s) {
  if (scene.textures.exists('hero')) scene.textures.remove('hero');
  const g = scene.make.graphics({ add: false });
  const col = (v, d) => parseInt(String(v || d).replace('#', ''), 16);
  const main = col(s.color, '#5aa9e6'), dark = 0x10202e;
  const [x, y, w, h] = heroBody(s), mid = x + w / 2;
  const extras = (s.extras || []).slice(0, 5), has = k => extras.some(e => e.kind === k);
  const ex = k => col((extras.filter(e => e.kind === k)[0] || {}).color, s.color);
  // behind the body
  if (has('cape')) g.fillStyle(ex('cape')).fillTriangle(x + 4, y + h * 0.3, x - 10, y + h, x + w * 0.6, y + h);
  if (has('wings')) { g.fillStyle(ex('wings')); g.fillTriangle(x + 4, y + h * 0.35, x - 16, y + h * 0.15, x + 2, y + h * 0.7); g.fillTriangle(x + w - 4, y + h * 0.35, x + w + 16, y + h * 0.15, x + w - 2, y + h * 0.7); }
  if (has('tail')) g.fillStyle(ex('tail')).fillTriangle(x + 6, y + h * 0.6, x - 18, y + h * 0.95, x + 6, y + h * 0.9);
  if (has('spikes')) { g.fillStyle(ex('spikes')); for (let i = 0; i < 4; i++) g.fillTriangle(x + 2 + i * (w / 4), y + 2, x + 6 + i * (w / 4), y - 8, x + 10 + i * (w / 4), y + 2); }
  // the body
  g.fillStyle(main);
  if (s.body === 'round' || s.body === 'blob') g.fillEllipse(mid, y + h / 2, w, h); else g.fillRoundedRect(x, y, w, h, 6);
  if (s.belly) g.fillStyle(col(s.belly)).fillEllipse(mid, y + h * 0.68, w * 0.6, h * 0.4);
  g.fillStyle(dark).fillRect(x + 6, y + h - 4, 10, 4).fillRect(x + w - 16, y + h - 4, 10, 4);   // feet
  // on the head
  const top = y;
  if (has('horns')) { g.fillStyle(ex('horns')); g.fillTriangle(x + w * 0.2, top + 4, x + w * 0.28, top - 12, x + w * 0.38, top + 4); g.fillTriangle(x + w * 0.62, top + 4, x + w * 0.72, top - 12, x + w * 0.8, top + 4); }
  if (has('ears-cat')) { g.fillStyle(ex('ears-cat')); g.fillTriangle(x, top + 8, x + 4, top - 10, x + 14, top + 2); g.fillTriangle(x + w, top + 8, x + w - 4, top - 10, x + w - 14, top + 2); }
  if (has('ears-round')) g.fillStyle(ex('ears-round')).fillCircle(x + 6, top + 2, 8).fillCircle(x + w - 6, top + 2, 8);
  if (has('ears-bunny')) g.fillStyle(ex('ears-bunny')).fillEllipse(x + w * 0.3, top - 10, 9, 26).fillEllipse(x + w * 0.7, top - 10, 9, 26);
  if (has('antenna')) { g.fillStyle(dark).fillRect(mid - 1, top - 12, 2, 12); g.fillStyle(ex('antenna')).fillCircle(mid, top - 14, 4); }
  if (has('crown')) { g.fillStyle(ex('crown')); g.fillRect(mid - 12, top - 4, 24, 6); g.fillTriangle(mid - 12, top - 4, mid - 9, top - 14, mid - 5, top - 4); g.fillTriangle(mid - 4, top - 4, mid, top - 16, mid + 4, top - 4); g.fillTriangle(mid + 5, top - 4, mid + 9, top - 14, mid + 12, top - 4); }
  if (has('hat-wizard')) { g.fillStyle(ex('hat-wizard')); g.fillRect(x - 4, top - 2, w + 8, 6); g.fillTriangle(x + 6, top - 2, mid + 6, top - 26, x + w - 6, top - 2); }
  if (has('helmet')) { g.fillStyle(ex('helmet')).fillRoundedRect(x - 2, top - 4, w + 4, h * 0.42, 8); g.fillStyle(dark).fillRect(x + 6, top + h * 0.2, w - 12, 5); }
  if (has('fins')) g.fillStyle(ex('fins')).fillTriangle(mid - 8, top + 2, mid, top - 14, mid + 8, top + 2);
  if (has('flame')) { g.fillStyle(0xff7a1a).fillTriangle(mid - 12, top + 2, mid - 4, top - 18, mid + 2, top + 2); g.fillStyle(0xffc23d).fillTriangle(mid - 4, top + 2, mid + 4, top - 22, mid + 12, top + 2); }
  if (has('leaf')) { g.fillStyle(0x4b3621).fillRect(mid - 1, top - 8, 2, 8); g.fillStyle(ex('leaf')).fillEllipse(mid + 7, top - 9, 14, 7); }
  if (has('cap')) { g.fillStyle(ex('cap')).fillEllipse(mid, top + 4, w + 2, 20); g.fillRoundedRect(mid, top + 6, w / 2 + 12, 6, 3); }
  if (has('bow')) g.fillStyle(ex('bow')).fillTriangle(x + w - 14, top + 2, x + w - 4, top - 6, x + w - 4, top + 10).fillTriangle(x + w - 14, top + 2, x + w - 24, top - 6, x + w - 24, top + 10);
  // the face (the hero looks right; the game flips it to walk left)
  const ey = y + (s.body === 'blob' ? h * 0.35 : h * 0.3), e1 = mid - w * 0.12, e2 = mid + w * 0.22, eye = col(s.eyeColor, '#10202e');
  if (s.eyes === 'visor') { g.fillStyle(eye).fillRoundedRect(x + 4, ey - 5, w - 8, 10, 4); g.fillStyle(0xffffff).fillRect(x + w - 16, ey - 3, 6, 3); }
  else if (s.eyes === 'one') { g.fillStyle(0xffffff).fillCircle(mid + 3, ey, 9); g.fillStyle(eye).fillCircle(mid + 6, ey, 4); }
  else if (s.eyes === 'sleepy') g.fillStyle(eye).fillRect(e1 - 5, ey, 10, 3).fillRect(e2 - 5, ey, 10, 3);
  else {
    const r = s.eyes === 'big' ? 7 : 5;
    g.fillStyle(0xffffff).fillCircle(e1, ey, r).fillCircle(e2, ey, r);
    g.fillStyle(eye).fillCircle(e1 + 2, ey, r / 2).fillCircle(e2 + 2, ey, r / 2);
    if (s.eyes === 'angry') g.fillStyle(dark).fillTriangle(e1 - 7, ey - 9, e1 + 7, ey - 5, e1 - 7, ey - 5).fillTriangle(e2 + 7, ey - 9, e2 - 7, ey - 5, e2 + 7, ey - 5);
  }
  if (has('snout')) { g.fillStyle(ex('snout')).fillRoundedRect(x + w - 8, ey + 4, 16, 12, 4); g.fillStyle(dark).fillRect(x + w + 2, ey + 7, 3, 3); }
  else if (has('beak')) g.fillStyle(ex('beak')).fillTriangle(x + w - 4, ey + 2, x + w + 12, ey + 7, x + w - 4, ey + 12);
  else if (has('mustache')) { const m = extras.filter(e => e.kind === 'mustache')[0]; g.fillStyle(col(m.color, '#3e2723')).fillEllipse(mid, ey + 12, 14, 7).fillEllipse(mid + 11, ey + 12, 14, 7); }
  else if (s.eyes !== 'visor') g.fillStyle(dark).fillRect(mid - 2, ey + 10, 12, 3);   // a smile
  if (has('whiskers')) { g.lineStyle(2, dark); g.lineBetween(x + w - 6, ey + 10, x + w + 10, ey + 6); g.lineBetween(x + w - 6, ey + 13, x + w + 10, ey + 14); }
  if (has('scarf')) { g.fillStyle(ex('scarf')).fillRect(x, y + h * 0.55, w, 7); g.fillRect(x + 4, y + h * 0.55, 7, 16); }
  g.generateTexture('hero', 80, 88);
  g.destroy();
}

// ---------- the sounds parts can use ----------
const SOUNDS = {
  ding: '/assets/platformer/sfx_coin.ogg',
  boing: '/assets/platformer/sfx_jump.ogg',
  buzz: '/assets/sfx-error.ogg'
};
const SOUND_WORDS = { ding: 'DING!', boing: 'BOING!', buzz: 'BZZT' };

new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  parent: 'game',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: 1200 } } },
  loader: { crossOrigin: 'anonymous' },
  scene: [Level]
});
