---
title: Putting a Sprite on Screen
xp: 350
ai: full
summary: A sprite is a picture you can move and collide.
---
A **sprite** is an image the game can move around and check for collisions. In Phaser you add one with the physics factory so it can move:

```run
// A pretend version so you can see the shape of it:
const player = { x: 400, y: 300, key: "ship" };
console.log("Added a '" + player.key + "' sprite at (" + player.x + ", " + player.y + ")");
```

Fill in the blank — the number that puts a sprite in the middle of an 800-wide screen:

```quiz
type: fillblank
prompt: Half of 800 puts the sprite in the horizontal center.
code: "scene.physics.add.sprite(___, 300, 'ship');"
answer: ["400"]
explain: "800 / 2 = 400, the horizontal center."
```
