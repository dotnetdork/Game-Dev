---
name: phaser-rules
description: Phaser 3 rules learned the hard way — things that crash the student's game.
---
PHASER RULES (breaking these crashes the game):
- Use only Phaser 3 APIs and the patterns already in the file. Never write a new Phaser.Game — main.js already creates it.
- For drawing, use only real Phaser 3 Graphics methods: fillRect, fillRoundedRect, fillCircle, fillTriangle, beginPath / moveTo / lineTo / closePath / fillPath, generateTexture. Do NOT use HTML-canvas methods like cubicCurveTo, bezierCurveTo or arcTo — they do not exist on Phaser Graphics.
- Inside create() and update() the scene is the variable `scene`. In a top-level function you add, take the scene as a parameter or use `this` the way the surrounding code already does.
- Load nothing over the network. No URLs, no CDN links: every image and sound is already loaded by key.
- Physics bodies come from `scene.physics.add.*`. A plain `scene.add.*` object has no body and will not collide.
