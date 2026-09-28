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
// ================================================================

class Level extends Phaser.Scene {
  constructor() { super('Level'); }

  preload() {
    // Every picture and sound a part can use.
    for (const key in ART) this.load.image(key, ART[key]);
    for (const key in SOUNDS) this.load.audio(key, SOUNDS[key]);
  }

  create() {
    const level = Studio.part('level');
    this.cameras.main.setBackgroundColor(level.look === 'hills' ? '#cfe8f7' : '#9a9a9a');
    if (level.look === 'hills') this.add.tileSprite(480, 270, 960, 540, 'hills').setTileScale(2.2);
    this.physics.world.gravity.y = level.gravity;
    this.made = {};                       // the game objects each part is drawn with
    this.player = null;
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
    const hero = p.look
      ? this.physics.add.sprite(where.x, where.y, p.look).setScale(HEROES[p.look] || 1)
      : this.add.rectangle(where.x, where.y, 40, 56, 0x4f4f4f);   // a grey box until it has a sprite
    if (!p.look) this.physics.add.existing(hero);
    hero.body.setSize(p.look ? hero.width * 0.6 : 40, p.look ? hero.height * 0.8 : 56);
    hero.body.setCollideWorldBounds(false);
    this.player = hero;
    Studio.parts.forEach(q => { if (q.kind !== 'player' && this.made[q.id]) this.connect(q); });
    return hero;
  }

  // A block 64 pixels tall, plus whatever fills the space below it.
  block(p, x, y, w, art, fill, grey, greyFill) {
    const top = art
      ? this.add.tileSprite(x + w / 2, y + 32, w, 64, art)
      : this.add.rectangle(x + w / 2, y + 32, w, 64, grey);
    const below = 540 - (y + 64);
    if (below > 0) {
      const under = art
        ? this.add.tileSprite(x + w / 2, y + 64 + below / 2, w, below, fill)
        : this.add.rectangle(x + w / 2, y + 64 + below / 2, w, below, greyFill);
      under.setData('trim', p.id);
    }
    return top;
  }

  makeFloor(p, x, w) {
    const floor = this.block(p, x, p.y, w, p.look && 'grass', 'dirt', 0x6e6e6e, 0x5f5f5f);
    this.physics.add.existing(floor, true);
    // Box Collider 2D: only a SOLID floor holds the player up.
    floor.body.enable = p.solid;
    return floor;
  }

  makeLava(p) {
    const lava = this.block(p, p.x, p.y, p.w, p.look && 'lava', 'lava_deep', 0x7c7c7c, 0x747474);
    this.physics.add.existing(lava, true);
    return lava;
  }

  makeCoin(p, x, y) {
    const coin = p.look
      ? this.add.image(x, y, p.look).setScale(0.8 * p.size)
      : this.add.circle(x, y, 15 * p.size, 0xc4c4c4).setStrokeStyle(3, 0x8f8f8f);
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
      this.sound.play(p.sound, { volume: 0.6 });
      this.pop(SOUND_WORDS[p.sound], coin.x, coin.y);
    }
    Studio.event('coin');
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
    this.player.setPosition(p.x, p.y);
    this.player.body.setVelocity(0, 0);
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

// ---------- the pictures and sounds parts can use ----------
const ART = {
  grass: '/assets/platformer/terrain_grass_block_top.png',
  dirt: '/assets/platformer/terrain_grass_block_center.png',
  lava: '/assets/platformer/lava_top.png',
  lava_deep: '/assets/platformer/lava.png',
  hills: '/assets/platformer/background_color_hills.png',
  coin_gold: '/assets/platformer/coin_gold.png',
  coin_silver: '/assets/platformer/coin_silver.png',
  gem_blue: '/assets/platformer/gem_blue.png',
  alien: '/assets/platformer/character_green_idle.png',
  pink: '/assets/platformer/character_pink_idle.png',
  slime: '/assets/platformer/slime_normal_rest.png',
  frog: '/assets/platformer/frog_idle.png',
  mouse: '/assets/platformer/mouse_rest.png'
};
const HEROES = { alien: 0.5, pink: 0.5, slime: 0.9, frog: 0.9, mouse: 0.9 };   // how big each hero is drawn
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
