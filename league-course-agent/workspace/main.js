// main.js - boots Star Catcher into the viewport
const config = {
  type: Phaser.AUTO,
  width: WIDTH, height: HEIGHT,
  parent: 'game',
  backgroundColor: '#0d2137',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade' },
  scene: { create: create, update: update }
};
new Phaser.Game(config);
